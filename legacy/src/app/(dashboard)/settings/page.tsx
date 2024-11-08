import { Tabs, TabsContent } from '@/components/ui/tabs';
import { getTranslator } from '@/lib/get-translator';
import { TipiConfig } from '@/server/core/TipiConfig';
import type { Metadata } from 'next';
import { getClass } from 'src/inversify.config';
import { getCurrentLocale } from 'src/utils/getCurrentLocale';
import { GeneralActions } from './components/GeneralActions';
import { LogsContainer } from './components/LogsContainer';
import { SecurityContainer } from './components/SecurityContainer';
import { SettingsContainer } from './components/SettingsContainer';
import { SettingsTabTriggers } from './components/SettingsTabTriggers';

export async function generateMetadata(): Promise<Metadata> {
  const translator = await getTranslator();

  return {
    title: `${translator('SETTINGS_TITLE')} - Tipi`,
  };
}

export default async function SettingsPage({ searchParams }: { searchParams: { tab: string } }) {
  const { tab } = searchParams;
  const systemService = getClass('ISystemService');
  const sessionManager = getClass('ISessionManager');

  const version = await systemService.getVersion();
  const settings = TipiConfig.getSettings();
  const locale = getCurrentLocale();
  const user = await sessionManager.getUserFromCookie();

  return (
    <div className="card d-flex">
      <Tabs defaultValue={tab || 'actions'}>
        <SettingsTabTriggers />
        <TabsContent value="actions">
          <GeneralActions version={version} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsContainer initialValues={settings} currentLocale={locale} />
        </TabsContent>
        <TabsContent value="security">
          <SecurityContainer totpEnabled={Boolean(user?.totpEnabled)} username={user?.username} />
        </TabsContent>
        <TabsContent value="logs">
          <LogsContainer />
        </TabsContent>
      </Tabs>
    </div>
  );
}
