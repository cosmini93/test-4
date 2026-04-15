import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Bot, Send, User, Loader2, Sparkles, AlertTriangle, History, Trash2 } from 'lucide-react';

export default function AIAgentPage() {
  const { api, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(`pid-${Date.now()}`);
  const messagesEnd = useRef(null);

  const scrollToBottom = () => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); };
  useEffect(() => { scrollToBottom(); }, [messages]);

  // Initial greeting
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      text: `Buna ziua, ${user?.nume || ''}! Sunt agentul PID de monitorizare. Pot sa:\n\n• Analizez starea planificarii curente\n• Identific comenzi la risc (deadline apropiat)\n• Sugerez replanificari si optimizari\n• Verific statusul aprovizionarii\n• Generez rapoarte\n\nCe doriti sa verificam?`,
      time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
    }]);
  }, [user]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', text: input, time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', { message: input, session_id: sessionId });
      const aiMsg = {
        role: 'assistant',
        text: res.data.response,
        time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
        actions: res.data.actions || []
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Eroare la comunicarea cu agentul AI. Va rog incercati din nou.',
        time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
        error: true
      }]);
    }
    setLoading(false);
  };

  const quickActions = [
    { label: 'Stare planificare', msg: 'Care este starea curenta a planificarii? Ce comenzi sunt neplanificate?' },
    { label: 'Comenzi urgente', msg: 'Ce comenzi PS sunt la risc cu deadline in urmatoarele 5 zile?' },
    { label: 'Incarcare linii', msg: 'Cum arata incarcarea liniilor de productie saptamana aceasta?' },
    { label: 'Raport zilnic', msg: 'Genereaza un raport zilnic cu starea planificarii, riscuri si actiuni necesare.' },
    { label: 'Programeaza mentenanta', msg: 'Programeaza o mentenanta pe linia Brutarie Cataloi pentru maine, schimbul 1, 2 ore, la cuptorul principal.' },
    { label: 'Sugestii optimizare', msg: 'Ce optimizari poti sugera pentru planificarea curenta?' },
  ];

  return (
    <div className="p-4 h-full flex flex-col" data-testid="ai-agent-page">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-sm bg-orange-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 font-['Work_Sans']">Agent AI Monitorizare</h1>
            <p className="text-xs text-zinc-500">GPT-5.2 &middot; Analiza planificare &middot; Sugestii &middot; Rapoarte</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-600 font-medium">Online</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 mb-3 shrink-0 overflow-x-auto pb-1">
        {quickActions.map((qa, i) => (
          <button key={i} onClick={() => { setInput(qa.msg); }} data-testid={`quick-action-${i}`}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-sm text-xs text-zinc-600 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 transition-colors whitespace-nowrap shrink-0">
            <Sparkles className="w-3 h-3" />{qa.label}
          </button>
        ))}
      </div>

      {/* Chat messages */}
      <div className="flex-1 border border-zinc-200 rounded-sm bg-white overflow-y-auto p-4 space-y-4 min-h-0" data-testid="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-sm bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-orange-600" />
              </div>
            )}
            <div className={`max-w-[75%] ${msg.role === 'user' ? 'bg-zinc-800 text-white' : msg.error ? 'bg-red-50 border border-red-200' : 'bg-zinc-50 border border-zinc-200'} rounded-sm px-4 py-3`}>
              <div className={`text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'text-white' : msg.error ? 'text-red-700' : 'text-zinc-800'}`}>{msg.text}</div>
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-200 space-y-1">
                  {msg.actions.map((a, ai) => (
                    <div key={ai} className={`flex items-center gap-2 text-xs ${a.success ? 'text-green-700' : 'text-red-600'}`}>
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${a.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {a.success ? '✓' : '✗'}
                      </span>
                      {a.msg}
                    </div>
                  ))}
                </div>
              )}
              <div className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-zinc-400' : 'text-zinc-400'}`}>{msg.time}</div>
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-sm bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-sm bg-orange-100 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-orange-600" />
            </div>
            <div className="bg-zinc-50 border border-zinc-200 rounded-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-orange-600 animate-spin" />
              <span className="text-sm text-zinc-500">Analizez datele...</span>
            </div>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      {/* Input */}
      <div className="mt-3 shrink-0">
        <div className="flex gap-2">
          <input data-testid="ai-input" type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Intreaba agentul AI despre planificare, riscuri, sugestii..."
            className="flex-1 h-10 px-4 border border-zinc-200 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-1" disabled={loading} />
          <button onClick={sendMessage} disabled={loading || !input.trim()} data-testid="send-btn"
            className="h-10 px-5 bg-orange-600 text-white rounded-sm hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2 font-medium text-sm transition-colors">
            <Send className="w-4 h-4" />Trimite
          </button>
        </div>
        <p className="text-[10px] text-zinc-400 mt-1">Agent PID powered by GPT-5.2 &middot; Datele sunt analizate in timp real din baza de date</p>
      </div>
    </div>
  );
}
