import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonInput,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import './Login.css';
import { useEffect, useState } from 'react';
import { authStorage } from '../../system/save.tokens';
import { apiClient, getConnection } from '../../system/api.client';
import { useHistory } from 'react-router';

export const Login = () => {
  const history = useHistory();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [incorrectCredentials, setIncorrectCredentials] = useState(false);

  const login = async () => {
    setIncorrectCredentials(false);

    try {
      const res = await apiClient.auth.login(getConnection(), {
        username,
        password,
      });
      await authStorage.saveTokens(res.accessToken, res.refreshToken);
      history.replace('/home');
    } catch (err) {
      console.error('login error:', err);
      setIncorrectCredentials(true);
    }
  };

  useEffect(() => {
    apiClient.user.getCurrentUser(getConnection()).then((user) => {
      if (user.id) {
        history.replace('/home');
      }
    });
  }, [history]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar class="login-header">
          <IonTitle>Login</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent scrollY={false} class="login-content">
        <IonCard className="login-card">
          <IonCardContent>
            <form>
              <IonInput
                className="login-input-el"
                labelPlacement="floating"
                label="username"
                value={username}
                onIonInput={(event) =>
                  setUsername(String(event.detail.value ?? ''))
                }
              ></IonInput>
              <IonInput
                className="login-input-el"
                labelPlacement="floating"
                label="password"
                type="password"
                value={password}
                onIonInput={(event) =>
                  setPassword(String(event.detail.value ?? ''))
                }
              ></IonInput>
              <IonButton
                onClick={login}
                className="login-input-el"
                expand="full"
              >
                Login
              </IonButton>
              <IonButton
                fill="clear"
                className="login-input-el"
                expand="full"
                onClick={() => history.push('/register')}
              >
                Create an account
              </IonButton>

              <p
                className="login-input-el"
                hidden={!incorrectCredentials}
                style={{ color: 'red' }}
              >
                Incorrect credentials
              </p>
            </form>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};
