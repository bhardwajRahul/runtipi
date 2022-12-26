import { faker } from '@faker-js/faker';
import { getTRPCMock } from './getTrpcMock';
import appHandlers from './handlers/appHandlers';

const graphqlHandlers = [appHandlers.listApps, appHandlers.getApp, appHandlers.installedApps, appHandlers.installApp];

export const handlers = [
  getTRPCMock({
    path: ['system', 'getVersion'],
    type: 'query',
    response: { current: '1.0.0', latest: '1.0.0' },
  }),
  getTRPCMock({
    path: ['system', 'update'],
    type: 'mutation',
    response: true,
    delay: 100,
  }),
  getTRPCMock({
    path: ['system', 'restart'],
    type: 'mutation',
    response: true,
    delay: 100,
  }),
  getTRPCMock({
    path: ['system', 'systemInfo'],
    type: 'query',
    response: { cpu: { load: 0.1 }, disk: { available: 1, total: 2, used: 1 }, memory: { available: 1, total: 2, used: 1 } },
  }),
  getTRPCMock({
    path: ['auth', 'login'],
    type: 'mutation',
    response: { token: 'token' },
  }),
  getTRPCMock({
    path: ['auth', 'logout'],
    type: 'mutation',
    response: true,
  }),
  getTRPCMock({
    path: ['auth', 'refreshToken'],
    type: 'mutation',
    response: { token: 'token' },
  }),
  getTRPCMock({
    path: ['auth', 'register'],
    type: 'mutation',
    response: { token: 'token' },
  }),
  getTRPCMock({
    path: ['auth', 'me'],
    type: 'query',
    response: {
      id: faker.datatype.number(),
      username: faker.internet.userName(),
    },
  }),
  getTRPCMock({
    path: ['auth', 'isConfigured'],
    type: 'query',
    response: true,
  }),
  ...graphqlHandlers,
];
