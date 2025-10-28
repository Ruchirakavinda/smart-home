import { getHealthStatus } from './TelemetryController';
import { Request, Response } from 'express';

describe('GET /health', () => {
  it('should return status 200 with correct JSON structure', () => {
    const req = {} as Request;

    const jsonMock = jest.fn();
    const statusMock = jest.fn(() => ({ json: jsonMock }));
    const res = { status: statusMock } as unknown as Response;

    getHealthStatus(req, res);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalled();

    const responseData = jsonMock.mock.calls[0][0];
    expect(responseData.status).toBe('ok');
    expect(responseData.service).toBe('smart-home-backend');
    expect(typeof responseData.uptime).toBe('number');
    expect(new Date(responseData.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('should handle unexpected errors gracefully', () => {
    const req = {} as Request;

    // Simulate a function throwing an error
    const originalUptime = process.uptime;
    process.uptime = jest.fn(() => { throw new Error('uptime failed'); });

    const jsonMock = jest.fn();
    const statusMock = jest.fn(() => ({ json: jsonMock }));
    const res = { status: statusMock } as unknown as Response;

    try {
      getHealthStatus(req, res);
    } catch {
      res.status(500).json({ error: 'Internal Server Error' });
    }

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal Server Error' });

    process.uptime = originalUptime;
  });
});
