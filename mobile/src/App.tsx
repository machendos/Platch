import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';

import './theme/variables.css';
import './index.css';

import { Login } from './pages/login/Login';
import { Register } from './pages/login/Register';
import { MainPage } from './pages/main-page/MainPage';
import { FieldLab } from './lab/FieldLab';

setupIonicReact();

// IonRouterOutlet (instead of a plain react-router Switch) drives Ionic's
// page transitions and lifecycle events (useIonViewDidEnter etc.).
// Note: it keeps visited pages mounted, showing only the active one.
const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      <IonRouterOutlet>
        <Route exact path="/login" component={Login} />
        <Route exact path="/register" component={Register} />
        <Route path="/home" component={MainPage} />
        <Route exact path="/lab" component={FieldLab} />
        <Route exact path="/">
          <Redirect to="/login" />
        </Route>
      </IonRouterOutlet>
    </IonReactRouter>
  </IonApp>
);

export default App;
