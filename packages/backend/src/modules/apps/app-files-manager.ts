import path from 'node:path';
import { execAsync } from '@/common/helpers/exec-helpers';
import { ConfigurationService } from '@/core/config/configuration.service';
import { FilesystemService } from '@/core/filesystem/filesystem.service';
import { LoggerService } from '@/core/logger/logger.service';
import { Injectable } from '@nestjs/common';
import { appInfoSchema } from '../marketplace/dto/marketplace.dto';

@Injectable()
export class AppFilesManager {
  constructor(
    private readonly configuration: ConfigurationService,
    private readonly filesystem: FilesystemService,
    private readonly logger: LoggerService,
  ) {}

  private getInstalledAppsFolder() {
    const { directories } = this.configuration.getConfig();

    return path.join(directories.dataDir, 'apps');
  }

  public getAppPaths(namespacedAppId: string) {
    const { directories } = this.configuration.getConfig();

    const [store, id] = namespacedAppId.split('_');

    if (!store || !id) {
      throw new Error(`Invalid namespaced app id: ${namespacedAppId}`);
    }

    return {
      appDataDir: path.join(directories.appDataDir, store, id),
      appInstalledDir: path.join(this.getInstalledAppsFolder(), store, id),
    };
  }

  /**
   * Get the app info from the installed apps apps
   * @param id - The app id
   */
  public async getInstalledAppInfo(id: string) {
    try {
      const { appInstalledDir } = this.getAppPaths(id);

      if (await this.filesystem.pathExists(path.join(appInstalledDir, 'config.json'))) {
        const configFile = await this.filesystem.readTextFile(path.join(appInstalledDir, 'config.json'));
        const parsedConfig = appInfoSchema.safeParse(JSON.parse(configFile ?? ''));

        if (!parsedConfig.success) {
          this.logger.debug(`App ${id} config error:`);
          this.logger.debug(parsedConfig.error);
        }

        if (parsedConfig.success && parsedConfig.data.available) {
          const description = (await this.filesystem.readTextFile(path.join(appInstalledDir, 'metadata', 'description.md'))) ?? '';
          return { ...parsedConfig.data, description };
        }
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Get the docker-compose.json file content from the installed app
   * @param id - The app id
   * @returns The content of docker-compose.yml as a string, or null if not found
   */
  public async getDockerComposeYaml(id: string) {
    const arch = this.configuration.get('architecture');
    const { appInstalledDir } = this.getAppPaths(id);
    let dockerComposePath = path.join(appInstalledDir, 'docker-compose.yml');

    if (arch === 'arm64' && (await this.filesystem.pathExists(path.join(appInstalledDir, 'docker-compose.arm64.yml')))) {
      dockerComposePath = path.join(appInstalledDir, 'docker-compose.arm64.yml');
    }

    let content = null;
    try {
      if (await this.filesystem.pathExists(dockerComposePath)) {
        content = await this.filesystem.readTextFile(dockerComposePath);
      }
    } catch (error) {
      this.logger.error(`Error getting docker-compose.yml for installed app ${id}: ${error}`);
    }

    return { path: dockerComposePath, content };
  }

  /**
   * Get the docker-compose.json file content from the installed app
   * @param id - The app id
   * @returns The content of docker-compose.json as a string, or null if not found
   */
  public async getDockerComposeJson(id: string) {
    const { appInstalledDir } = this.getAppPaths(id);
    const dockerComposePath = path.join(appInstalledDir, 'docker-compose.json');

    let content = null;
    try {
      if (await this.filesystem.pathExists(dockerComposePath)) {
        content = await this.filesystem.readJsonFile(dockerComposePath);
      }
    } catch (error) {
      this.logger.error(`Error getting docker-compose.json for installed app ${id}: ${error}`);
    }

    return { path: dockerComposePath, content };
  }

  /**
   * Write the docker-compose.yml file to the installed app folder
   * @param appId - The app id
   * @param composeFile - The content of the docker-compose.yml file
   */
  public async writeDockerComposeYml(appId: string, composeFile: string) {
    const { appInstalledDir } = this.getAppPaths(appId);
    const dockerComposePath = path.join(appInstalledDir, 'docker-compose.yml');

    await this.filesystem.writeTextFile(dockerComposePath, composeFile);
  }

  public async deleteAppFolder(appId: string) {
    const { appInstalledDir } = this.getAppPaths(appId);
    await this.filesystem.removeDirectory(appInstalledDir);
  }

  public async deleteAppDataDir(appId: string) {
    const { appDataDir } = this.getAppPaths(appId);
    await this.filesystem.removeDirectory(appDataDir);
  }

  public async createAppDataDir(appId: string) {
    const { appDataDir } = this.getAppPaths(appId);
    await this.filesystem.createDirectory(appDataDir);
  }

  /**
   * Set the permissions for the app data directory
   * @param appId - The app id
   */
  public async setAppDataDirPermissions(appId: string) {
    const { appDataDir } = this.getAppPaths(appId);

    await execAsync(`chmod -Rf a+rwx ${appDataDir}`).catch(() => {
      this.logger.error(`Error setting permissions for app ${appId}`);
    });
  }

  public async getAppEnv(appId: string) {
    const { appDataDir } = this.getAppPaths(appId);

    const envPath = path.join(appDataDir, 'app.env');

    let env = '';
    if (await this.filesystem.pathExists(envPath)) {
      env = (await this.filesystem.readTextFile(envPath)) ?? '';
    }

    return { path: envPath, content: env };
  }

  public async writeAppEnv(appId: string, env: string) {
    const { appDataDir } = this.getAppPaths(appId);

    const envPath = path.join(appDataDir, 'app.env');

    await this.filesystem.writeTextFile(envPath, env);
  }

  /**
   * Get the user env file content
   * @param appId - The app id
   */
  public async getUserEnv(appId: string) {
    const { directories } = this.configuration.getConfig();

    const userEnvFile = path.join(directories.dataDir, 'user-config', appId, 'app.env');
    let content = null;

    if (await this.filesystem.pathExists(userEnvFile)) {
      content = await this.filesystem.readTextFile(userEnvFile);
    }

    return { path: userEnvFile, content };
  }

  public async getUserComposeFile(appId: string) {
    const { directories } = this.configuration.getConfig();

    const userComposeFile = path.join(directories.dataDir, 'user-config', appId, 'docker-compose.yml');
    let content = null;

    if (await this.filesystem.pathExists(userComposeFile)) {
      content = await this.filesystem.readTextFile(userComposeFile);
    }

    return { path: userComposeFile, content };
  }
}
