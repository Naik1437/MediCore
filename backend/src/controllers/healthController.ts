import { Request, Response } from 'express';
import { prisma } from '../prisma.js';

export class HealthController {
  static live(req: Request, res: Response) {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'medicore-backend',
      version: '1.0.0',
    });
  }

  static async ready(req: Request, res: Response) {
    try {
      // Test database connectivity
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({
        status: 'READY',
        timestamp: new Date().toISOString(),
        database: 'CONNECTED',
      });
    } catch (error: any) {
      res.status(503).json({
        status: 'NOT_READY',
        timestamp: new Date().toISOString(),
        database: 'DISCONNECTED',
        error: error.message,
      });
    }
  }
}
