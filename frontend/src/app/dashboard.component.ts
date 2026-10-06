import {Component,inject,OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HttpClient} from '@angular/common/http';
import {FormsModule} from '@angular/forms';
import {AuthService} from './auth.service';

@Component({standalone:true,imports:[CommonModule,FormsModule],template:`
<div class="shell">
<aside class="side">
<div class="brand">Vendor <span>Intelligence</span></div>
<button class="nav" [class.active]="tab==='overview'" (click)="tab='overview'">Overview</button>
<button class="nav" [class.active]="tab==='vendors'" (click)="tab='vendors'">Vendor Management</button>
<button class="nav" [class.active]="tab==='procurement'" (click)="tab='procurement'">Procurement & POs</button>
<button class="nav" [class.active]="tab==='performance'" (click)="tab='performance'">Performance</button>
<button class="nav" [class.active]="tab==='analytics'" (click)="tab='analytics'">Risk Analytics</button>
<button class="nav" [class.active]="tab==='contracts'" (click)="tab='contracts'">Contracts</button>
<button class="nav" [class.active]="tab==='messages'" (click)="tab='messages'">Communication</button>
<button class="nav" [class.active]="tab==='notifications'" (click)="tab='notifications'">Notifications</button>
<button class="nav" [class.active]="tab==='reports'" (click)="tab='reports'">Reports</button>
</aside>
<main class="main">
<div class="top"><div><h1>{{title()}}</h1><p class="muted">{{name}} · {{role}}</p></div><button class="logout" (click)="logout()">Sign out</button></div>

<section *ngIf="tab==='overview'">
<div class="grid">
<div class="card"><span class="muted">Vendors</span><div class="metric">{{vendors.length}}</div></div>
<div class="card"><span class="muted">Purchase Orders</span><div class="metric">{{pos.length}}</div></div>
<div class="card"><span class="muted">Active Contracts</span><div class="metric">{{contracts.length}}</div></div>
<div class="card"><span class="muted">High Risk Vendors</span><div class="metric">{{highRisk()}}</div></div>
</div>
<div class="two section"><div class="card"><h3>Reliability Overview</h3><div *ngFor="let x of analytics" style="margin:13px 0"><b>{{x.vendor_name}}</b><span style="float:right">{{x.score}} · {{x.risk}}</span><div style="height:10px;background:#eef2f6;border-radius:8px;margin-top:5px"><div [style.width.%]="x.score" style="height:10px;background:#635bff;border-radius:8px"></div></div></div></div>
<div class="card"><h3>System Notifications</h3><div class="alert" *ngFor="let n of notifications">{{n.title}}<br><span class="muted">{{n.message}}</span></div></div></div>
</section>

<section *ngIf="tab==='vendors'">
<div class="card"><h2>Vendor Directory</h2><button class="btn primary" (click)="addVendor()" *ngIf="canManage()">+ Register Vendor</button>
<table class="table section"><thead><tr><th>Vendor</th><th>Category</th><th>Contact</th><th>Status</th><th>Action</th></tr></thead><tbody>
<tr *ngFor="let v of vendors"><td>{{v.name}}</td><td>{{v.category}}</td><td>{{v.contact_name}}</td><td><span class="pill" [class.low]="v.status==='Approved'" [class.medium]="v.status==='Under Review'" [class.high]="v.status==='Rejected'">{{v.status}}</span></td><td><button class="btn green" *ngIf="canManage() && v.status!=='Approved'" (click)="approveVendor(v.id)">Approve</button></td></tr>
</tbody></table></div>
</section>

<section *ngIf="tab==='procurement'">
<div class="card"><h2>Purchase Orders</h2><button class="btn primary" *ngIf="canManage()" (click)="createPO()">+ Create PO</button>
<table class="table section"><thead><tr><th>PO</th><th>Vendor</th><th>Amount</th><th>Expected</th><th>Status</th><th>Next</th></tr></thead>
<tbody><tr *ngFor="let p of pos"><td>{{p.po_number}}</td><td>{{vendorName(p.vendor_id)}}</td><td>₹{{p.total_amount | number}}</td><td>{{p.expected_delivery}}</td><td>{{p.status}}</td><td><button class="btn" *ngIf="canManage()" (click)="advancePO(p)">{{nextStatus(p.status)}}</button></td></tr></tbody></table></div>
</section>

<section *ngIf="tab==='performance'">
<div class="card"><h2>Vendor Performance & Historical Trend</h2><select [(ngModel)]="selectedVendor" (change)="loadPerformance()"><option *ngFor="let v of vendors" [value]="v.id">{{v.name}}</option></select>
<table class="table section"><thead><tr><th>Period</th><th>On-time</th><th>Quality</th><th>Response hrs</th><th>Completion</th></tr></thead>
<tbody><tr *ngFor="let p of performance"><td>{{p.period}}</td><td>{{p.on_time_deliveries}}/{{p.total_deliveries}}</td><td>{{p.quality_rating | number:'1.1-1'}}/5</td><td>{{p.response_hours}}</td><td>{{p.orders_completed}}/{{p.orders_total}}</td></tr></tbody></table></div>
</section>

<section *ngIf="tab==='analytics'">
<div class="grid"><div class="card" *ngFor="let x of analytics"><span class="muted">{{x.vendor_name}}</span><div class="metric">{{x.score}}</div><span class="pill" [class.low]="x.risk==='Low'" [class.medium]="x.risk==='Medium'" [class.high]="x.risk==='High'">{{x.risk}} Risk</span><p class="muted">Delivery {{x.factors.delivery}} · Quality {{x.factors.quality}}</p><p>{{recommend(x)}}</p></div></div>
</section>

<section *ngIf="tab==='contracts'"><div class="card"><h2>Contract & Compliance Tracker</h2><table class="table"><thead><tr><th>Contract</th><th>Vendor</th><th>Expiry</th><th>Value</th><th>Compliance</th></tr></thead><tbody><tr *ngFor="let c of contracts"><td>{{c.contract_number}}</td><td>{{vendorName(c.vendor_id)}}</td><td>{{c.expiry_date}}</td><td>₹{{c.value | number}}</td><td>{{c.compliance_status}}</td></tr></tbody></table></div></section>

<section *ngIf="tab==='messages'"><div class="two"><div class="card"><h2>Communication</h2><textarea [(ngModel)]="message" rows="4" placeholder="Write a message..."></textarea><br><button class="btn primary" (click)="sendMessage()">Send</button></div><div class="card"><h2>History</h2><div *ngFor="let m of messages" class="alert"><b>{{m.sender}}</b>: {{m.body}}</div></div></div></section>

<section *ngIf="tab==='notifications'"><div class="card"><h2>Notifications</h2><div class="alert" *ngFor="let n of notifications"><b>{{n.title}}</b><br>{{n.message}}</div></div></section>

<section *ngIf="tab==='reports'"><div class="grid"><div class="card"><h3>Vendor Reliability Report</h3><p class="muted">Current database-backed reliability data.</p><button class="btn primary" (click)="download('csv')">Download CSV</button> <button class="btn" (click)="download('xlsx')">Excel</button></div><div class="card"><h3>Procurement Report</h3><p class="muted">Purchase order data can be exported from the API.</p><button class="btn" (click)="download('csv')">Generate</button></div></div></section>

</main></div>`})
export class DashboardComponent implements OnInit{
 private http=inject(HttpClient); private auth=inject(AuthService); api=this.auth.api;
 tab='overview'; vendors:any[]=[];pos:any[]=[];contracts:any[]=[];analytics:any[]=[];notifications:any[]=[];messages:any[]=[];performance:any[]=[];selectedVendor:any='';message='';name=localStorage.getItem('name')||'';role=localStorage.getItem('role')||'';
 ngOnInit(){this.loadAll()}
 title(){return ({overview:'Administrator Dashboard',vendors:'Vendor Management',procurement:'Procurement Dashboard',performance:'Vendor Performance Dashboard',analytics:'Reliability & Risk Analytics',contracts:'Contract & Compliance',messages:'Communication Center',notifications:'Notification Center',reports:'Reports Dashboard'} as any)[this.tab]}
 loadAll(){this.http.get<any[]>(this.api+'/vendors').subscribe(x=>{this.vendors=x;if(!this.selectedVendor&&x.length)this.selectedVendor=x[0].id;this.loadPerformance()});this.http.get<any[]>(this.api+'/purchase-orders').subscribe(x=>this.pos=x);this.http.get<any[]>(this.api+'/contracts').subscribe(x=>this.contracts=x);this.http.get<any>(this.api+'/analytics').subscribe(x=>this.analytics=x.vendors);this.http.get<any[]>(this.api+'/notifications').subscribe(x=>this.notifications=x);this.http.get<any[]>(this.api+'/messages').subscribe(x=>this.messages=x)}
 loadPerformance(){if(this.selectedVendor)this.http.get<any[]>(this.api+'/performance/'+this.selectedVendor).subscribe(x=>this.performance=x)}
 vendorName(id:number){return this.vendors.find(v=>v.id==id)?.name||'—'}
 canManage(){return ['Administrator','Procurement Manager'].includes(this.role)}
 approveVendor(id:number){this.http.patch(this.api+'/vendors/'+id+'/status',{status:'Approved'}).subscribe(()=>this.loadAll())}
 addVendor(){const name=prompt('Vendor name');if(!name)return;const category=prompt('Category','IT');const contact=prompt('Contact name','New Contact');const email=prompt('Email','vendor@example.com');const phone=prompt('Phone','9000000000');this.http.post(this.api+'/vendors',{name,category,contact_name:contact,email,phone}).subscribe(()=>this.loadAll())}
 createPO(){const v=this.vendors.find(x=>x.status==='Approved');if(!v){alert('No approved vendor available');return}const item=prompt('Item','Office Equipment');if(!item)return;const qty=Number(prompt('Quantity','5'));const price=Number(prompt('Unit price','10000'));const date=prompt('Expected delivery YYYY-MM-DD',new Date(Date.now()+7*86400000).toISOString().slice(0,10));this.http.post(this.api+'/purchase-orders',{vendor_id:v.id,item,quantity:qty,unit_price:price,expected_delivery:date}).subscribe(()=>this.loadAll())}
 nextStatus(s:string){return ({Pending:'Approve',Approved:'Order',Ordered:'Deliver',Delivered:'Complete'} as any)[s]||'—'}
 advancePO(p:any){const ns=({Pending:'Approved',Approved:'Ordered',Ordered:'Delivered',Delivered:'Completed'} as any)[p.status];if(ns)this.http.patch(this.api+'/purchase-orders/'+p.id+'/status',{status:ns}).subscribe(()=>this.loadAll())}
 highRisk(){return this.analytics.filter(x=>x.risk==='High').length}
 recommend(x:any){if(x.risk==='High')return 'Review supplier allocation and initiate corrective action.';if(x.risk==='Medium')return 'Monitor delivery commitments and response time.';return 'Continue approved supplier status.'}
 sendMessage(){if(!this.message)return;const v=this.selectedVendor||this.vendors[0]?.id;this.http.post(this.api+'/messages',{vendor_id:Number(v),body:this.message}).subscribe(()=>{this.message='';this.loadAll()})}
 download(type:string){this.http.get(this.api+'/reports/vendors.'+type,{responseType:'blob'}).subscribe(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='vendor_reliability_report.'+type;a.click()})}
 logout(){this.auth.logout()}
}
