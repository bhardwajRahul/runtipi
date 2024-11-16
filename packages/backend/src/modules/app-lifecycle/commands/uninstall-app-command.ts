import { LoggerService } from '@/core/logger/logger.service';
import { AppFilesManager } from '@/modules/apps/app-files-manager';
import { DockerService } from '@/modules/docker/docker.service';
import type { AppEventFormInput } from '@/modules/queue/entities/app-events';
import { AppLifecycleCommand } from './command';

export class UninstallAppCommand extends AppLifecycleCommand {
  constructor(logger: LoggerService, appFilesManager: AppFilesManager, dockerService: DockerService) {
    super(logger, appFilesManager, dockerService);

    this.logger = logger;
    this.appFilesManager = appFilesManager;
  }

  public async execute(appId: string, form: AppEventFormInput) {
    try {
      this.logger.info(`Uninstalling app ${appId}`);
      await this.ensureAppDir(appId, form);

      await this.dockerService.composeApp(appId, 'down --remove-orphans --volumes --rmi all').catch((err) => {
        this.logger.warn(
          `Could not fully uninstall app ${appId}. Some images may be in use by other apps or a folder has been deleted. Consider cleaning unused images docker system prune -a`,
          err,
        );
      });

      await this.appFilesManager.deleteAppFolder(appId);
      await this.appFilesManager.deleteAppDataDir(appId);

      this.logger.info(`App ${appId} uninstalled`);

      return { success: true, message: `App ${appId} uninstalled successfully` };
    } catch (err) {
      return this.handleAppError(err, appId, 'uninstall');
    }
  }
}