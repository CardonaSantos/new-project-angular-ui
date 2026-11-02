
import {GcCurrentAvatarStore} from './gc-current-avatar.store';
import type {UserRecord} from '../../features/users/data-access/users.models';
const user=(id:string,url:string|null)=>({id,profile:{avatar:{mediaId:url?'m1':null,url}}}) as UserRecord;

describe('Current user avatar state',()=>{
 it('uses the server-provided private URL and updates it after PUT',async()=>{
  const store=new GcCurrentAvatarStore();
  await store.loadFor('u1',async()=>user('u1','https://storage.example/photo?signature=abc'));
  expect(store.url()).toBe('https://storage.example/photo?signature=abc');
  store.updateFrom(user('u1','https://storage.example/new?signature=def'));
  expect(store.url()).toBe('https://storage.example/new?signature=def');
  store.updateFrom(user('other','https://storage.example/not-mine'));
  expect(store.url()).toBe('https://storage.example/new?signature=def');
  store.clear();
  expect(store.url()).toBe(null);
 });
 it('discards a stale profile request after a newer login or avatar update',async()=>{
  const store=new GcCurrentAvatarStore();
  let complete!: (u:UserRecord)=>void;
  const pending=new Promise<UserRecord>(resolve=>complete=resolve);
  const old=store.loadFor('u1',()=>pending);
  await store.loadFor('u2',async()=>user('u2','new-user-image'));
  complete(user('u1','stale-image'));
  await old;
  expect(store.url()).toBe('new-user-image');
  const older=store.loadFor('u2',()=>Promise.resolve(user('u2','old-photo')));
  store.updateFrom(user('u2','just-uploaded'));
  await older;
  expect(store.url()).toBe('just-uploaded');
 });
});
