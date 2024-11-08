import { and, asc, eq, ne, notInArray } from 'drizzle-orm';
import { appTable, type App, type NewApp, type AppStatus, type IDbClient } from '@runtipi/db';
import { inject, injectable } from 'inversify';

export interface IAppQueries {
  getApp: (appId: string) => Promise<App | undefined>;
  updateApp: (appId: string, data: Partial<NewApp>) => Promise<App | undefined>;
  deleteApp: (appId: string) => Promise<void>;
  createApp: (data: NewApp) => Promise<App | undefined>;
  getAppsByStatus: (status: AppStatus) => Promise<App[]>;
  getApps: () => Promise<App[]>;
  getGuestDashboardApps: () => Promise<App[]>;
  getAppsByDomain: (domain: string, id: string) => Promise<App[]>;
  updateAppsByStatusNotIn: (statuses: AppStatus[], data: Partial<NewApp>) => Promise<App[]>;
}

@injectable()
export class AppQueries implements IAppQueries {
  constructor(@inject('IDbClient') private dbClient: IDbClient) {}

  /**
   * Given an app id, return the app
   *
   * @param {string} appId - The id of the app to return
   */
  public async getApp(appId: string) {
    return this.dbClient.db.query.appTable.findFirst({ where: eq(appTable.id, appId) });
  }

  /**
   * Given an app id, update the app with the given data
   *
   * @param {string} appId - The id of the app to update
   * @param {Partial<NewApp>} data - The data to update the app with
   */
  public async updateApp(appId: string, data: Partial<NewApp>) {
    const updatedApps = await this.dbClient.db.update(appTable).set(data).where(eq(appTable.id, appId)).returning().execute();
    return updatedApps[0];
  }

  /**
   * Given an app id, delete the app
   *
   * @param {string} appId - The id of the app to delete
   */
  public async deleteApp(appId: string) {
    await this.dbClient.db.delete(appTable).where(eq(appTable.id, appId)).execute();
  }

  /**
   * Given app data, creates a new app
   *
   * @param {NewApp} data - The data to create the app with
   */
  public async createApp(data: NewApp) {
    const newApps = await this.dbClient.db.insert(appTable).values(data).returning().execute();
    return newApps[0];
  }

  /**
   * Returns all apps installed with the given status sorted by id ascending
   *
   * @param {AppStatus} status - The status of the apps to return
   */
  public async getAppsByStatus(status: AppStatus) {
    return this.dbClient.db.query.appTable.findMany({ where: eq(appTable.status, status), orderBy: asc(appTable.id) });
  }

  /**
   * Returns all apps installed sorted by id ascending
   */
  public async getApps() {
    return this.dbClient.db.query.appTable.findMany({ orderBy: asc(appTable.id) });
  }

  /**
   * Returns all apps that are running and visible on guest dashboard sorted by id ascending
   */
  public async getGuestDashboardApps() {
    return this.dbClient.db.query.appTable.findMany({
      where: and(eq(appTable.status, 'running'), eq(appTable.isVisibleOnGuestDashboard, true)),
      orderBy: asc(appTable.id),
    });
  }

  /**
   * Given a domain, return all apps that have this domain, are exposed and not the given id
   *
   * @param {string} domain - The domain to search for
   * @param {string} id - The id of the app to exclude
   */
  public async getAppsByDomain(domain: string, id: string) {
    return this.dbClient.db.query.appTable.findMany({ where: and(eq(appTable.domain, domain), eq(appTable.exposed, true), ne(appTable.id, id)) });
  }

  /**
   * Given an array of app status, update all apps that have a status not in the array with new values
   *
   * @param {AppStatus[]} statuses - The statuses to exclude from the update
   * @param {Partial<NewApp>} data - The data to update the apps with
   */
  public async updateAppsByStatusNotIn(statuses: AppStatus[], data: Partial<NewApp>) {
    return this.dbClient.db.update(appTable).set(data).where(notInArray(appTable.status, statuses)).returning().execute();
  }
}
