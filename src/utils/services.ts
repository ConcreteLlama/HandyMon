import { makeServiceFromName, type ServiceController } from './service';
import { getAppConfig } from './app-config';
import type { ServiceConfig } from '@/types/app-config';

export function listServiceConfigs(): ServiceConfig[] {
  return getAppConfig().services;
}

export function getServiceConfig(id: string): ServiceConfig | null {
  return getAppConfig().services.find(s => s.id === id) ?? null;
}

export function controllerFor(cfg: ServiceConfig): ServiceController {
  return makeServiceFromName(cfg.serviceName, cfg.type);
}
