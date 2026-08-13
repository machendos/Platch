import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonInput,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from '@ionic/react';
import './Login.css';
import { useState } from 'react';
import { apiClient, getConnection } from '../../system/api.client';

function validatePassword(password: string): string | null {
  if (password.length < 9) return 'Password must be at least 9 characters.';
  if (!/[a-zA-Z]/.test(password))
    return 'Password must contain at least one letter.';
  if (!/\d/.test(password)) return 'Password must contain at least one digit.';
  return null;
}

export const Register = () => {
  const { push } = useIonRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const register = async () => {
    setError(null);

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== repeatPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await apiClient.user.createUser(getConnection(), { username, password });
      push('/login', 'back', 'replace');
    } catch (e) {
      console.log(e);

      setError('Username is already taken. Please choose a different one.');
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar class="login-header">
          <IonButtons slot="start">
            <IonBackButton defaultHref="/login" />
          </IonButtons>
          <IonTitle>Create an account</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent scrollY={false} class="login-content">
        <IonCard className="login-card">
          <IonCardContent>
            <form>
              <IonInput
                className="login-input-el"
                labelPlacement="floating"
                label="Username"
                autocapitalize="none"
                autocorrect="off"
                value={username}
                onIonInput={(e) => setUsername(String(e.detail.value ?? ''))}
              />
              <IonInput
                className="login-input-el"
                labelPlacement="floating"
                label="Password"
                type="password"
                value={password}
                onIonInput={(e) => setPassword(String(e.detail.value ?? ''))}
              />
              <IonInput
                className="login-input-el"
                labelPlacement="floating"
                label="Repeat password"
                type="password"
                value={repeatPassword}
                onIonInput={(e) =>
                  setRepeatPassword(String(e.detail.value ?? ''))
                }
              />
              <IonButton
                onClick={register}
                className="login-input-el"
                expand="full"
              >
                Create account
              </IonButton>
              {error && (
                <p
                  className="login-input-el"
                  style={{ color: 'red', margin: '0 20px' }}
                >
                  {error}
                </p>
              )}
            </form>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};
