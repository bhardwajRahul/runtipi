import { getTranslator } from '@/lib/get-translator';
import { getClass } from 'src/inversify.config';
import { ResetPasswordContainer } from './components/ResetPasswordContainer';

export default async function ResetPasswordPage() {
  const authService = getClass('IAuthService');
  const isRequested = await authService.checkPasswordChangeRequest();

  if (isRequested) {
    return <ResetPasswordContainer />;
  }

  const translator = await getTranslator();

  return (
    <>
      <h2 className="h2 text-center mb-3">{translator('AUTH_RESET_PASSWORD_TITLE')}</h2>
      <p>{translator('AUTH_RESET_PASSWORD_INSTRUCTIONS')}</p>
      <pre>
        <code>./runtipi-cli reset-password</code>
      </pre>
    </>
  );
}
