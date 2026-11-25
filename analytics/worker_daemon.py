"""
MC-09 & MC-08: Dedicated Notification Worker Daemon.
Features:
- Connects to private Redis instance for FIFO job queue ('medicore:notifications:queue')
- Dead-letter queue ('medicore:notifications:dlq') for failed-job recovery
- Idempotency preservation across service restarts via persistent Redis SETNX
- Graceful shutdown on SIGTERM / SIGINT signals
- Periodic healthcheck file updates for Docker health monitoring
- Non-root execution compatibility
"""

import os
import sys
import time
import json
import signal
import logging
from typing import Optional, Dict, Any

try:
    import redis
except ImportError:
    redis = None

from analytics.worker import NotificationJob, NotificationWorker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [notification-worker]: %(message)s"
)
logger = logging.getLogger("medicore-worker-daemon")

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
QUEUE_NAME = "medicore:notifications:queue"
DLQ_NAME = "medicore:notifications:dlq"
HEALTH_FILE = "/tmp/worker_healthy" if os.name != "nt" else "C:\\Users\\HANMANTHU\\worker_healthy"

running = True

def handle_shutdown(signum, frame):
    global running
    logger.info(f"Received termination signal ({signum}). Initiating graceful shutdown...")
    running = False

def update_health_marker():
    try:
        with open(HEALTH_FILE, "w") as f:
            f.write(str(time.time()))
    except Exception as e:
        logger.debug(f"Could not touch health file: {e}")

def main():
    signal.signal(signal.SIGINT, handle_shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_shutdown)

    logger.info(f"Starting MediCore Notification Worker. Redis: {REDIS_HOST}:{REDIS_PORT}")

    redis_client = None
    if redis:
        try:
            redis_client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                decode_responses=True,
                socket_connect_timeout=2
            )
            redis_client.ping()
            logger.info("Connected successfully to Redis message queue.")
        except Exception as e:
            logger.warning(f"Redis unavailable ({e}). Worker running in resilient standby polling mode.")
            redis_client = None

    worker = NotificationWorker(redis_client=redis_client)
    update_health_marker()

    while running:
        update_health_marker()
        if redis_client:
            try:
                # Pop next notification job from Redis queue with 2s timeout
                raw_item = redis_client.blpop(QUEUE_NAME, timeout=2)
                if raw_item:
                    _, payload_str = raw_item
                    data = json.loads(payload_str)
                    job = NotificationJob(
                        recipient=data.get("recipient"),
                        channel=data.get("channel", "EMAIL"),
                        template_id=data.get("template_id", "GENERAL"),
                        payload=data.get("payload", {}),
                        idempotency_key=data.get("idempotency_key"),
                        max_retries=data.get("max_retries", 3)
                    )
                    res = worker.dispatch(job)
                    logger.info(f"Processed notification job {job.job_id}: status={res['status']}")

                    if res["status"] == "FAILED":
                        logger.error(f"Moving job {job.job_id} to dead-letter queue ({DLQ_NAME})")
                        redis_client.rpush(DLQ_NAME, json.dumps(res))
            except Exception as err:
                logger.error(f"Error processing job loop: {err}")
                time.sleep(1)
        else:
            # Standby sleep when Redis is mocked/local
            time.sleep(2)

    logger.info("Notification Worker shutdown completed cleanly.")
    if os.path.exists(HEALTH_FILE):
        try:
            os.remove(HEALTH_FILE)
        except Exception:
            pass

if __name__ == "__main__":
    main()
