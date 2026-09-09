import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';

import './theme/variables.css';
import './index.css';

import { Login } from './pages/login/Login';
import { Register } from './pages/login/Register';
import { MainPage } from './pages/main-page/MainPage';

setupIonicReact();

/* One cache for the whole app, above the router: `IonRouterOutlet` keeps
   visited pages mounted, so a cache created inside a page would outlive
   nothing and be recreated by any remount. */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /* Server data here is only changed by this client or by the same user on
         another device, so a window refocus is the moment worth refetching on
         rather than a timer. */
      staleTime: 30_000,
      retry: 2,
    },
  },
});

// IonRouterOutlet (instead of a plain react-router Switch) drives Ionic's
// page transitions and lifecycle events (useIonViewDidEnter etc.).
// Note: it keeps visited pages mounted, showing only the active one.
const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet>
          <Route exact path="/login" component={Login} />
          <Route exact path="/register" component={Register} />
          <Route path="/home" component={MainPage} />
          <Route exact path="/">
            <Redirect to="/login" />
          </Route>
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  </QueryClientProvider>
);

export default App;
