// layout.component.ts
import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

import { Router } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  isSidebarCollapsed = false;

  constructor(private auth: AuthService, private router: Router) {
    console.log('🏗️ SidebarComponent constructor ejecutado');
  }

  toggleSidebar() {
    console.log('🔄 Toggle sidebar ejecutado');
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  logout() {
    console.log('🚪 Logout ejecutado desde sidebar');
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
