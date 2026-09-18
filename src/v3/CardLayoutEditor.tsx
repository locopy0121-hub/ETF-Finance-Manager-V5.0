import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { V3CardSpan } from './model';

export type V3LayoutChoice={key:string;label:string;category?:string;hint?:string};
const widthFor=(span:V3CardSpan)=>span===12?'100%':span===9?'73.8%':span===8?'65.4%':span===6?'48.5%':span===4?'31%':'22.5%';
const spanLabel=(span:V3CardSpan)=>span===12?'整列':span===9?'3/4':span===8?'2/3':span===6?'1/2':span===4?'1/3':'1/4';

function DragItem({index,label,span,onMove,onSpan}:{index:number;label:string;span:V3CardSpan;onMove:(from:number,to:number)=>void;onSpan:(span:V3CardSpan)=>void}){
 const pos=useRef(new Animated.ValueXY()).current; const [dragging,setDragging]=useState(false);
 const pan=useMemo(()=>PanResponder.create({
  onStartShouldSetPanResponder:()=>true,
  onMoveShouldSetPanResponder:(_event:any,g:any)=>Math.abs(g.dx)>4||Math.abs(g.dy)>4,
  onPanResponderGrant:()=>{setDragging(true);pos.setValue({x:0,y:0})},
  onPanResponderMove:Animated.event([null,{dx:pos.x,dy:pos.y}],{useNativeDriver:false}),
  onPanResponderRelease:(_event:any,g:any)=>{setDragging(false);const col=Math.round(g.dx/88),row=Math.round(g.dy/82)*3;onMove(index,index+col+row);Animated.spring(pos,{toValue:{x:0,y:0},useNativeDriver:false}).start()},
  onPanResponderTerminate:()=>{setDragging(false);Animated.spring(pos,{toValue:{x:0,y:0},useNativeDriver:false}).start()},
 }),[index,onMove,pos]);
 return <Animated.View style={[styles.dragItem,{width:widthFor(span),transform:pos.getTranslateTransform()},dragging&&styles.dragging]}>
  <View style={styles.dragHead}><TouchableOpacity {...pan.panHandlers} style={styles.handle}><Text style={styles.handleText}>☰</Text></TouchableOpacity><Text style={styles.dragLabel}>{label}</Text></View>
  <View style={styles.spanRow}>{([12,9,8,6,4,3] as V3CardSpan[]).map(x=><TouchableOpacity key={x} onPress={()=>onSpan(x)} style={[styles.spanBtn,x===span&&styles.spanBtnOn]}><Text style={styles.spanText}>{spanLabel(x)}</Text></TouchableOpacity>)}</View>
 </Animated.View>;
}

export function CardLayoutEditor({visible,title,choices,selected,spans,onSave,onClose}:{visible:boolean;title:string;choices:V3LayoutChoice[];selected:string[];spans:Record<string,V3CardSpan>;onSave:(selected:string[],spans:Record<string,V3CardSpan>)=>void;onClose:()=>void}){
 const insets=useSafeAreaInsets(); const [keys,setKeys]=useState(selected); const [localSpans,setLocalSpans]=useState(spans); const [query,setQuery]=useState(''); const [category,setCategory]=useState('全部');
 useEffect(()=>{if(visible){setKeys(selected);setLocalSpans(spans);setQuery('');setCategory('全部')}},[visible,selected,spans]);
 const labels=useMemo(()=>Object.fromEntries(choices.map(x=>[x.key,x.label])),[choices]);
 const categories=useMemo(()=>['全部',...Array.from(new Set(choices.map(x=>x.category||'其他')))], [choices]);
 const filtered=useMemo(()=>choices.filter(x=>(category==='全部'||(x.category||'其他')===category)&&(!query.trim()||`${x.label} ${x.hint||''}`.toLowerCase().includes(query.trim().toLowerCase()))),[choices,category,query]);
 const toggle=(key:string)=>setKeys(cur=>cur.includes(key)?cur.filter(x=>x!==key):[...cur,key]);
 const move=(from:number,to:number)=>setKeys(cur=>{const target=Math.max(0,Math.min(cur.length-1,to));if(from===target)return cur;const next=[...cur];const [item]=next.splice(from,1);next.splice(target,0,item);return next});
 return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><SafeAreaView edges={['top','left','right','bottom']} style={styles.safe}>
  <View style={styles.header}><View style={{flex:1}}><Text style={styles.title}>{title}</Text><Text style={styles.sub}>欄位不限數量。長按 ☰ 拖曳排序，並可設定整列、1/2、1/3、1/4。</Text></View><TouchableOpacity style={styles.close} onPress={onClose}><Text style={styles.closeText}>✕</Text></TouchableOpacity></View>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.body,{paddingBottom:110+insets.bottom}]}>
   <TextInput value={query} onChangeText={setQuery} placeholder="搜尋資料欄位…" placeholderTextColor="#94A3B8" style={styles.search}/>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>{categories.map(c=><TouchableOpacity key={c} onPress={()=>setCategory(c)} style={[styles.chip,category===c&&styles.chipOn]}><Text style={styles.chipText}>{c}</Text></TouchableOpacity>)}</ScrollView>
   <View style={styles.choiceGrid}>{filtered.map(c=>{const active=keys.includes(c.key);return <TouchableOpacity key={c.key} onPress={()=>toggle(c.key)} style={[styles.choice,active&&styles.choiceOn]}><Text style={styles.choiceText}>{active?'✓ ':'＋ '}{c.label}</Text>{c.hint?<Text style={styles.hint}>{c.hint}</Text>:null}</TouchableOpacity>})}</View>
   <View style={styles.sectionHead}><Text style={styles.sectionTitle}>已選 {keys.length} 項｜拖曳排版</Text><Text style={styles.sectionHint}>不使用 ↑ ↓</Text></View>
   {keys.length?<View style={styles.grid}>{keys.map((key,index)=><DragItem key={key} index={index} label={labels[key]||key} span={localSpans[key]||6} onMove={move} onSpan={span=>setLocalSpans(cur=>({...cur,[key]:span}))}/>)}</View>:<Text style={styles.empty}>尚未選擇資料欄位。</Text>}
  </ScrollView>
  <View style={[styles.footer,{paddingBottom:12+insets.bottom}]}><TouchableOpacity style={styles.cancel} onPress={onClose}><Text style={styles.cancelText}>取消</Text></TouchableOpacity><TouchableOpacity style={styles.save} onPress={()=>{onSave(keys,localSpans);onClose()}}><Text style={styles.saveText}>儲存排版</Text></TouchableOpacity></View>
 </SafeAreaView></Modal>;
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#F8FAFC'},header:{flexDirection:'row',alignItems:'center',gap:12,padding:16,borderBottomWidth:1,borderBottomColor:'#E2E8F0'},title:{color:'#0F172A',fontSize:21,fontWeight:'900'},sub:{color:'#64748B',fontSize:10,lineHeight:15,marginTop:4},close:{width:40,height:40,borderRadius:20,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},closeText:{color:'#0066FF',fontSize:18},body:{padding:16},search:{height:46,borderRadius:12,borderWidth:1,borderColor:'#E2E8F0',backgroundColor:'#FFFFFF',paddingHorizontal:12,color:'#0F172A'},categoryRow:{gap:7,paddingVertical:10},chip:{paddingHorizontal:12,paddingVertical:8,borderRadius:18,borderWidth:1,borderColor:'#E2E8F0',backgroundColor:'#FFFFFF'},chipOn:{borderColor:'#0066FF',backgroundColor:'rgba(0,102,255,.12)'},chipText:{color:'#0F172A',fontSize:10,fontWeight:'800'},choiceGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},choice:{width:'48.5%',minHeight:52,borderRadius:12,borderWidth:1,borderColor:'#E2E8F0',backgroundColor:'#FFFFFF',padding:10,justifyContent:'center'},choiceOn:{borderColor:'rgba(76,201,240,.6)',backgroundColor:'rgba(76,201,240,.09)'},choiceText:{color:'#0F172A',fontSize:10.5,fontWeight:'900',flexWrap:'wrap'},hint:{color:'#64748B',fontSize:8.5,lineHeight:12,marginTop:4},sectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:20,marginBottom:10},sectionTitle:{color:'#0F172A',fontSize:15,fontWeight:'900'},sectionHint:{color:'#0066FF',fontSize:9},grid:{flexDirection:'row',flexWrap:'wrap',gap:7,justifyContent:'flex-start'},dragItem:{minHeight:88,borderRadius:12,borderWidth:1,borderColor:'#E2E8F0',backgroundColor:'#FFFFFF',padding:9,zIndex:1},dragging:{zIndex:99,elevation:8,opacity:.92},dragHead:{flexDirection:'row',alignItems:'flex-start',gap:7},handle:{width:30,height:30,borderRadius:8,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},handleText:{color:'#0066FF',fontSize:17,fontWeight:'900'},dragLabel:{flex:1,color:'#0F172A',fontSize:10.5,fontWeight:'900',flexWrap:'wrap'},spanRow:{flexDirection:'row',gap:3,flexWrap:'wrap',marginTop:8},spanBtn:{paddingHorizontal:6,paddingVertical:5,borderRadius:7,backgroundColor:'#FFFFFF'},spanBtnOn:{borderWidth:1,borderColor:'#0066FF',backgroundColor:'rgba(0,102,255,.14)'},spanText:{color:'#0F172A',fontSize:8,fontWeight:'800'},empty:{color:'#64748B',paddingVertical:18},footer:{position:'absolute',left:0,right:0,bottom:0,flexDirection:'row',gap:10,paddingHorizontal:12,paddingTop:12,borderTopWidth:1,borderTopColor:'rgba(255,255,255,.08)',backgroundColor:'#FFFFFF'},cancel:{flex:1,minHeight:48,borderRadius:13,borderWidth:1,borderColor:'#E2E8F0',alignItems:'center',justifyContent:'center'},cancelText:{color:'#0F172A',fontWeight:'900'},save:{flex:2,minHeight:48,borderRadius:13,backgroundColor:'#0066FF',alignItems:'center',justifyContent:'center'},saveText:{color:'#FFFFFF',fontWeight:'900'}});
