import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      if (err.code === 'auth/invalid-credential') {
        setError('Email ou mot de passe incorrect');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Trop de tentatives. Réessayez plus tard.');
      } else {
        setError('Erreur de connexion. Réessayez.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="h-screen bg-surface-0 flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-wider">
            buro<span className="text-brand-500">.</span>
          </h1>
          <p className="text-txt-3 text-sm mt-2">Système de gestion</p>
        </div>

        {/* Login Form */}
        <div className="bg-surface-1 border border-bord rounded-2xl p-8">
          <h2 className="text-lg font-semibold mb-6">Connexion</h2>

          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-txt-3 uppercase tracking-wider mb-2">
                Email
              </label>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
                autoFocus
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-txt-3 uppercase tracking-wider mb-2">
                Mot de passe
              </label>
              <input
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-center text-txt-3 text-xs mt-6">
          YOUNASSER SARL — Caisse & Gestion
        </p>
      </div>
    </div>
  );
}
