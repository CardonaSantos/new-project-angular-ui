import {Component,computed,input} from '@angular/core';
import {NgxEchartsDirective,provideEchartsCore} from 'ngx-echarts';
import * as echarts from 'echarts/core';
import {LineChart,BarChart} from 'echarts/charts';
import {GridComponent,TooltipComponent,LegendComponent,AriaComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';
import type {EChartsCoreOption} from 'echarts/core';
import {formatCalendarDate} from '../../../shared/formatting';
import {chartAmount,reportMoney} from '../data-access/reports.helpers';
import type {ReportsOverview,PaymentMethodReport,ExpenseCategoryReport} from '../data-access/reports.models';
echarts.use([LineChart,BarChart,GridComponent,TooltipComponent,LegendComponent,AriaComponent,CanvasRenderer]);
const text='#bcaea6',grid='#62564b',main='#d6a47e',second='#8ac2b6',third='#aa8acc';
@Component({
 selector:'gc-reports-daily-chart',
 imports:[NgxEchartsDirective],
 providers:[provideEchartsCore({echarts})],
 template:`
 @if(report();as data){
  @if(data.serieDiaria.length){
   <div echarts class="rep-chart" [options]="options()" [autoResize]="true"
    role="img" [attr.aria-label]="description()"></div>
   <details class="rep-chart-data">
    <summary>Ver datos diarios de la gráfica</summary>
    <div class="rep-table-wrap"><table class="rep-table">
     <thead><tr><th>Fecha operativa</th><th>Ventas</th><th>Cobros netos</th><th>Gastos</th></tr></thead>
     <tbody>
      @for(day of data.serieDiaria;track day.fechaOperativa){
       <tr><td>{{dateLabel(day.fechaOperativa)}}</td>
        <td>{{money(day.ventasNetas,data.currency)}}</td>
        <td>{{money(day.cobrosNetos,data.currency)}}</td>
        <td>{{money(day.gastosRegistrados,data.currency)}}</td></tr>
      }
     </tbody>
    </table></div>
   </details>
  }@else{<p class="rep-muted">Sin datos para este período.</p>}
 }
 `
})
export class GcReportsDailyChart{
 readonly report=input.required<ReportsOverview>();
 protected readonly money=reportMoney;
 protected readonly dateLabel=formatCalendarDate;
 protected readonly description=computed(()=>{
  const d=this.report();return 'Evolución diaria de ventas, cobros netos y gastos del '+d.periodo.desde+' al '+d.periodo.hasta;
 });
 protected readonly options=computed<EChartsCoreOption>(()=>{
  const data=this.report().serieDiaria,axis=data.map(x=>formatCalendarDate(x.fechaOperativa,'DD/MM'));
  const currency=this.report().currency;
  const lines=[
   {name:'Ventas',field:'ventasNetas' as const,color:main},
   {name:'Cobros netos',field:'cobrosNetos' as const,color:second},
   {name:'Gastos registrados',field:'gastosRegistrados' as const,color:third}
  ];
  return {animationDuration:250,
   color:lines.map(x=>x.color),textStyle:{color,fontFamily:'inherit'},
   aria:{enabled:true,description:this.description()},
   tooltip:{trigger:'axis',valueFormatter:(value:unknown)=>reportMoney(String(value??'0'),currency)},
   legend:{top:0,textStyle:{color:text},icon:'roundRect'},
   grid:{left:14,right:16,top:46,bottom:26,containLabel:true},
   xAxis:{type:'category',data:axis,axisLine:{lineStyle:{color:grid}},
    axisLabel:{color:text},axisTick:{show:false}},
   yAxis:{type:'value',splitLine:{lineStyle:{color:grid,opacity:.35}},
    axisLabel:{color:text,formatter:(v:number)=>v>=1000?(v/1000).toFixed(1)+'k':String(v)}},
   series:lines.map(item=>({
    type:'line',name:item.name,smooth:true,showSymbol:data.length<=14,symbolSize:7,
    lineStyle:{width:3},areaStyle:{opacity:.06},
    data:data.map(x=>chartAmount(x[item.field]))
   }))}
  } as EChartsCoreOption;
 });
}
@Component({
 selector:'gc-reports-breakdown-chart',
 imports:[NgxEchartsDirective],
 providers:[provideEchartsCore({echarts})],
 template:`
 @if(rows().length){
  <div echarts class="rep-chart rep-chart-small" [options]="options()"
   role="img" [attr.aria-label]="title()"></div>
 }@else{<p class="rep-muted">Sin registros para este período.</p>}
 `
})
export class GcReportsBreakdownChart{
 readonly title=input.required<string>();
 readonly currency=input('GTQ');
 readonly rows=input.required<readonly {label:string;amount:string}[]>();
 protected readonly options=computed<EChartsCoreOption>(()=>{
  const data=this.rows().slice(0,10),cur=this.currency();
  return {animationDuration:250,color:[main],
   aria:{enabled:true,description:this.title()},
   textStyle:{color:text,fontFamily:'inherit'},
   tooltip:{trigger:'axis',axisPointer:{type:'shadow'},
    valueFormatter:(v:unknown)=>reportMoney(String(v??'0'),cur)},
   grid:{left:12,right:22,top:10,bottom:18,containLabel:true},
   xAxis:{type:'value',splitLine:{lineStyle:{color:grid,opacity:.35}},
    axisLabel:{color:text,formatter:(v:number)=>v>=1000?(v/1000).toFixed(1)+'k':String(v)}},
   yAxis:{type:'category',data:data.map(x=>x.label),inverse:true,
    axisLabel:{color:text,width:125,overflow:'truncate'},
    axisLine:{show:false},axisTick:{show:false}},
   series:[{type:'bar',barMaxWidth:22,data:data.map(x=>chartAmount(x.amount)),
    itemStyle:{borderRadius:[0,5,5,0]}}]
  } as EChartsCoreOption;
 });
}
/** Keep source types imported in this module for chart/HTML contract parity. */
export type ReportChartInputs=PaymentMethodReport|ExpenseCategoryReport;
