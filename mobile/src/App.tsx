import { Redirect, Route, Switch, BrowserRouter } from 'react-router-dom';
import { IonApp, setupIonicReact } from '@ionic/react';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';

import './theme/variables.css';
import './index.css';

import { Login } from './pages/login/Login';
import { Register } from './pages/login/Register';
import { Home } from './pages/common/Home';

setupIonicReact();

const App: React.FC = () => (
  <IonApp>
    <BrowserRouter>
      <Switch>
        <Route exact path="/login" component={Login} />
        <Route exact path="/register" component={Register} />
        <Route exact path="/">
          <Redirect to="/login" />
        </Route>
        <Route path="/home" component={Home} />
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    </BrowserRouter>
  </IonApp>
);

export default App;
