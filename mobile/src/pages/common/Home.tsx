import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import './home.css';

export const Home = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar class="login-header">
          <IonTitle>Platch MAIN PAGE</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent scrollY={false} class="login-content">
        <p>Content</p>
      </IonContent>
    </IonPage>
  );
};
