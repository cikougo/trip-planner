import { Routes } from '@angular/router';

import { AuthComponent } from './components/auth/auth.component';

import { DashboardComponent } from './components/dashboard/dashboard.component';
import { AuthGuard } from './services/auth.guard';
import { TripComponent } from './components/trip/trip.component';
import { TripsComponent } from './components/trips/trips.component';
import { SharedTripComponent } from './components/shared-trip/shared-trip.component';
import { NewTripComponent } from './components/new-trip/trip.component';

export const routes: Routes = [
  {
    path: 'auth',
    pathMatch: 'full',
    component: AuthComponent,
    title: 'Vali Travels - Authentication',
  },

  {
    path: 's',
    children: [
      {
        path: 't/:token',
        component: SharedTripComponent,
        title: 'Vali Travels - Shared Trip',
      },

      { path: '**', redirectTo: '/home', pathMatch: 'full' },
    ],
  },

  {
    path: '',
    canActivate: [AuthGuard],
    children: [
      {
        path: 'home',
        component: DashboardComponent,
        title: 'Vali Travels - Map',
      },
      {
        path: 'trips',
        children: [
          {
            path: '',
            component: TripsComponent,
            title: 'Vali Travels - Trips',
          },
          {
            path: ':id',
            component: TripComponent,
            title: 'Vali Travels - Trip',
          },
          {
            path: 'n/:id',
            component: NewTripComponent,
            title: 'Vali Travels - Trip',
          },
        ],
      },

      { path: '**', redirectTo: '/home', pathMatch: 'full' },
    ],
  },

  { path: '**', redirectTo: '/', pathMatch: 'full' },
];
