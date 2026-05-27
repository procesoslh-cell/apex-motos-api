'use client';
import {useState} from 'react';
import {apiPost} from '../../lib/api';

export default function Login(){
  const[username,setUsername]=useState('');
  const[password,setPassword]=useState('');
  const[show,setShow]=useState(false);
  const[error,setError]=useState('');
  const[loading,setLoading]=useState(false);
  async function submit(e:any){
    e.preventDefault();setError('');setLoading(true);
    try{
      const d=await apiPost('/auth/login',{username,password});
      localStorage.setItem('token',d.token);
      localStorage.setItem('user',JSON.stringify(d.user));
      window.location.href='/';
    }catch{setError('Usuario o contraseña incorrectos')}
    finally{setLoading(false)}
  }
  return <div className='login-screen'>
    <div className='login-grid'></div>
    <div className='login-glow login-glow-a'></div>
    <div className='login-glow login-glow-b'></div>
    <form onSubmit={submit} className='login-card'>
      <div className='login-brand'>
        <div className='brand-mark'>NX</div>
        <div>
          <span className='login-kicker'>ERP comercial</span>
          <h1>APEX-MOTOS</h1>
        </div>
      </div>
      <h2>Bienvenido</h2>
      <p className='login-subtitle'>Ingresá a tu panel de gestión</p>
      <label className='login-label'>Usuario / Email</label>
      <div className='login-field'><span>👤</span><input value={username} onChange={e=>setUsername(e.target.value)} placeholder='usuario@empresa.com' autoFocus/></div>
      <label className='login-label'>Contraseña</label>
      <div className='login-field'><span>🔒</span><input type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder='••••••••'/><button type='button' onClick={()=>setShow(!show)}>{show?'Ocultar':'Ver'}</button></div>
      <div className='login-options'><label><input type='checkbox'/> Recordarme</label><span>¿Olvidaste tu clave?</span></div>
      {error&&<p className='login-error'>{error}</p>}
      <button className='login-btn' disabled={loading}>{loading?'Ingresando...':'Ingresar al Panel →'}</button>
      <div className='login-footer'>Desarrollado y Diseñado por <b>Nexo Consultora</b></div>
    </form>
  </div>
}
