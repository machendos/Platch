import { ConfigService } from '../config/config.service';
import { randomUUID } from 'node:crypto';

export const pinoLoggerOptions = {
  timestamp: () => `,"time":"${new Date().toISOString()}"`,

  formatters: { bindings: () => ({}) },

  redact: ['req.body.password'],

  hooks: {
    logMethod(inputArgs, method) {
      // for removing the default behavior of PinoLogger
      return inputArgs[0].res && inputArgs[0].err
        ? method.apply(this, [{ ...inputArgs[0], err: undefined }])
        : method.apply(this, inputArgs as any);
    },
  },

  serializers: {
    req: (req) => {
      const request = req.raw;

      const { remoteAddress, remotePort } = request.socket;
      return {
        genReqId: randomUUID(),
        ip: req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress,

        method: request.method,
        url: request.originalUrl,
        query: request.query,
        body: request.body,
        remoteAddress,
        remotePort,

        headers: {
          'user-agent': request.headers?.['user-agent'],
          Authorization: request.headers?.Authorization,
        },
      };
    },
    res: (res) => ({ statusCode: res.statusCode }),
  },
};
