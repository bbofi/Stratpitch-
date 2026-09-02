import React, { useState, useEffect, useRef } from "react";
import { Zap, Send, Loader2, Copy, Check, Trash2, MessageCircle, ShieldAlert, ArrowRight, Lock, Sparkles, X, Target, ShieldCheck, Clock, Repeat, Users, Plus, CheckCircle2, XCircle, AlertCircle, ChevronRight, ArrowLeft, LogOut } from "lucide-react";

const TONES = ["Urgent", "Friendly", "Premium"];
const PLATFORMS = ["WhatsApp", "Instagram / Facebook", "In-person / Phone"];

const DEMOGRAPHICS = [
  {
    id: "men",
    label: "Men",
    sub: "Status / Power",
    trigger: "Status, leverage, and edge — how this purchase raises his position and control.",
    objectionLens: "\"Too expensive\" or \"I need to think about it\" from this buyer usually really means: \"I'm not yet convinced this elevates my status enough to justify the capital or the risk to my position.\"",
    counterFocus: "Leverage, ROI on status, and the cost of inaction — what it costs him in position and edge to stay where he is.",
  },
  {
    id: "women",
    label: "Women",
    sub: "Confidence / Expression",
    trigger: "Confidence, alignment, and self-worth — internal validation and overcoming self-doubt.",
    objectionLens: "\"Too expensive\" or hesitation from this buyer usually really means: \"I haven't fully given myself permission yet — I'm not sure I trust this decision, or myself, enough.\"",
    counterFocus: "Self-trust, removing internal friction, and guaranteed support — making the decision feel safe to trust, not just logical.",
  },
  {
    id: "parents",
    label: "Parents",
    sub: "Peace / Security",
    trigger: "Protection, peace of mind, and family security — removing worry, not adding features.",
    objectionLens: "\"Too expensive\" from this buyer usually really means: \"I'm terrified this is a risk that could compromise my family's security if it goes wrong.\"",
    counterFocus: "Risk-reversal, safety, and long-term security — proof that this protects rather than endangers what they're responsible for.",
  },
  {
    id: "youth",
    label: "Youth / Aspiring",
    sub: "Future / Mobility",
    trigger: "Future mobility and ambition — proof that this moves them closer to where they're headed.",
    objectionLens: "\"Too expensive\" or \"I need to think about it\" from this buyer usually really means: \"I'm not sure this is the right next move for where I'm trying to go, or I'm afraid of wasting money on the wrong bet.\"",
    counterFocus: "Momentum and cost of delay — how much further ahead they'd be by acting now versus waiting.",
  },
  {
    id: "unisex",
    label: "Unisex / Universal",
    sub: "Broad appeal",
    trigger: "Practical, broadly relatable value — no single identity angle, just clear everyday benefit.",
    objectionLens: "\"Too expensive\" from this buyer usually really means: \"I'm not yet sure the practical value outweighs the cost for my specific situation.\"",
    counterFocus: "Clear, concrete value-for-money and real-world proof — practical reassurance over identity or status framing.",
  },
];

const PRODUCT_VECTORS = [
  "High-ticket status item",
  "Daily utility",
  "Emotional / Transformational service",
  "Risk-reduction tool",
];
const FREE_LIMIT = 3;
const PLAN_PRICE = "K150 / month";
const TESTING_UNLIMITED = true; // TEMP: set to false before sharing with real clients — bypasses the free-script limit for testing/editing

// ============================================================
// SUPABASE — INFRASTRUCTURE LAYER (Phases 1–3: accounts, customers, follow-ups)
// Replace these two values with your real project's from Settings > API.
// No SDK import needed — these call Supabase's REST endpoints directly with fetch,
// since this environment can only import from a fixed set of libraries.
// NOTE: session is kept in React state only (no localStorage in artifacts), so
// reloading this artifact will log you out — the real deployed site should persist
// the session properly using the full @supabase/supabase-js client instead.
// ============================================================
const SUPABASE_URL = "https://tbpznruqoiniywhifcur.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRicHpucnVxb2luaXl3aGlmY3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMDQwMDMsImV4cCI6MjEwMzg4MDAwM30.DInoX6Fl4w76YCKLt65dSU-uEQokAFhMNgy3Bjd9fY4";

async function sbSignUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Sign up failed");
  return data;
}

async function sbSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Login failed");
  return data; // { access_token, user, ... }
}

function sbHeaders(accessToken) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function sbGetCustomers(accessToken) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=*,objections(*)&order=created_at.desc`, {
    headers: sbHeaders(accessToken),
  });
  if (!res.ok) throw new Error("Failed to load customers");
  return res.json();
}

async function sbAddCustomer(accessToken, userId, { name, phone, product }) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/customers`, {
    method: "POST",
    headers: { ...sbHeaders(accessToken), Prefer: "return=representation" },
    body: JSON.stringify([{ user_id: userId, name, phone, product }]),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to add customer");
  return data[0];
}

async function sbUpdateCustomer(accessToken, customerId, updates) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${customerId}`, {
    method: "PATCH",
    headers: { ...sbHeaders(accessToken), Prefer: "return=representation" },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to update customer");
  return data[0];
}

async function sbLogObjection(accessToken, userId, customerId, { objectionText, responseText, demographic, productVector }) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/objections`, {
    method: "POST",
    headers: { ...sbHeaders(accessToken), Prefer: "return=representation" },
    body: JSON.stringify([{
      customer_id: customerId,
      user_id: userId,
      objection_text: objectionText,
      response_text: responseText || null,
      demographic: demographic || null,
      product_vector: productVector || null,
    }]),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to log objection");
  return data[0];
}


function useStorageList(prefix) {
  const [items, setItems] = useState([]);
  const refresh = async () => {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
      const res = { keys: keys.map((key) => ({ key })) };
      if (!res || !res.keys) { setItems([]); return; }
      const loaded = [];
      for (const k of res.keys) {
        try {
          const raw = localStorage.getItem(k);
          const r = raw !== null ? { value: raw } : null;
          if (r && r.value) loaded.push(JSON.parse(r.value));
        } catch (e) {}
      }
      loaded.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setItems(loaded);
    } catch (e) {
      setItems([]);
    }
  };
  useEffect(() => { refresh(); }, []);
  return [items, refresh];
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-slate-600 text-slate-300 hover:border-orange-500 hover:text-orange-500 transition-colors"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function PaywallModal({ onClose, business }) {
  const WHATSAPP_NUMBER = "260979699111";
  const message = business
    ? `Hi! I've been using StratPitch for "${business}" and I'd like to unlock the unlimited plan (${PLAN_PRICE}).`
    : `Hi! I've been using StratPitch and I'd like to unlock the unlimited plan (${PLAN_PRICE}).`;
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4 z-50">
      <div className="bg-slate-800 border border-slate-600 rounded-xl max-w-md w-full p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X size={18} />
        </button>
        <div className="w-10 h-10 rounded-lg bg-orange-500/15 flex items-center justify-center mb-4">
          <Lock size={18} className="text-orange-500" />
        </div>
        <h2 className="display text-[20px] leading-tight mb-2">You've used your {FREE_LIMIT} free scripts</h2>
        <p className="text-[13.5px] text-slate-300 leading-relaxed mb-5">
          Keep the pitches, objection handlers, and follow-ups coming — upgrade for unlimited
          scripts every month.
        </p>

        <div className="bg-slate-900 border border-slate-600 rounded-lg p-4 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-orange-500" />
            <span className="text-[13px] font-semibold">Unlimited Plan</span>
          </div>
          <div className="display text-[24px] mb-3">{PLAN_PRICE}</div>
          <ul className="text-[12.5px] text-slate-300 space-y-1.5">
            <li>• Unlimited sales scripts, every month</li>
            <li>• Full saved history across all your products</li>
            <li>• New tones and platforms as they're added</li>
          </ul>
        </div>

        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 bg-orange-500 text-slate-900 font-semibold py-3 rounded-lg hover:bg-orange-400 transition-colors mb-2 no-underline"
        >
          Message us on WhatsApp to unlock
        </a>
        <p className="mono text-[9.5px] text-slate-400 text-center leading-relaxed">
          We'll set you up with the {PLAN_PRICE} plan directly
        </p>
      </div>
    </div>
  );
}

function WelcomeModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4 z-50">
      <div className="bg-slate-800 border border-slate-600 rounded-xl max-w-md w-full p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X size={18} />
        </button>
        <div className="w-11 h-11 rounded-lg bg-orange-500 flex items-center justify-center mb-4">
          <Zap size={20} className="text-slate-900" strokeWidth={2.5} />
        </div>
        <h2 className="display text-[21px] leading-tight mb-2">Welcome to StratPitch</h2>
        <p className="text-[13.5px] text-slate-300 leading-relaxed mb-4">
          Tell us what you're selling and we'll write the pitch, handle the objections, and
          draft the follow-up — built to target the real reason a customer hesitates, not
          just the surface features.
        </p>
        <div className="bg-slate-900 border border-slate-600 rounded-lg p-4 mb-5">
          <ul className="text-[12.5px] text-slate-300 space-y-2">
            <li>• Fill in your business, product, and customer once</li>
            <li>• Get a full sales script in seconds</li>
            <li>• Paste in a real customer objection anytime for an instant reply</li>
          </ul>
        </div>
        <button
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 bg-orange-500 text-slate-900 font-semibold py-3 rounded-lg hover:bg-orange-400 transition-colors"
        >
          Let's get started
        </button>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin"); // signin | signup
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    setInfo("");
    try {
      if (mode === "signup") {
        await sbSignUp(email.trim(), password);
        setInfo("Account created — check your email to confirm, then log in.");
        setMode("signin");
      } else {
        const data = await sbSignIn(email.trim(), password);
        onLogin({ accessToken: data.access_token, user: data.user });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-7 w-full max-w-sm">
        <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center mb-4">
          <Zap size={18} className="text-slate-900" strokeWidth={2.5} />
        </div>
        <h1 className="text-[19px] font-bold mb-1">STRATPITCH</h1>
        <p className="text-[12.5px] text-slate-400 mb-5">
          {mode === "signin" ? "Log in to access your customers and follow-ups." : "Create an account to get started."}
        </p>

        <label className="text-[10px] text-slate-400 tracking-widest block mb-1.5 font-mono">EMAIL</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="you@business.com"
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-orange-500 transition-colors placeholder:text-slate-500 mb-3"
        />
        <label className="text-[10px] text-slate-400 tracking-widest block mb-1.5 font-mono">PASSWORD</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="••••••••"
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-orange-500 transition-colors placeholder:text-slate-500 mb-4"
        />

        <button
          onClick={handleSubmit}
          disabled={!email.trim() || !password.trim() || loading}
          className="w-full flex items-center justify-center gap-2 bg-orange-500 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold py-3 rounded-lg hover:bg-orange-400 transition-colors mb-2"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {mode === "signin" ? "Log In" : "Create Account"}
        </button>
        <button
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setInfo(""); }}
          className="w-full text-[12.5px] text-slate-400 hover:text-white py-2"
        >
          {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Log in"}
        </button>

        {error && <p className="text-[12.5px] text-orange-500 mt-3">{error}</p>}
        {info && <p className="text-[12.5px] text-emerald-500 mt-3">{info}</p>}

        <div className="mt-5 pt-4 border-t border-slate-700">
          <button
            onClick={() => onLogin({ accessToken: null, user: { id: "demo" }, isDemo: true })}
            className="w-full text-[12px] text-slate-500 hover:text-slate-300 py-1"
          >
            Skip login — preview Generate tab only (this chat preview can't reach Supabase)
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [business, setBusiness] = useState("");
  const [product, setProduct] = useState("");
  const [customer, setCustomer] = useState("");
  const [price, setPrice] = useState("");
  const [demographic, setDemographic] = useState(DEMOGRAPHICS[0].id);
  const [productVector, setProductVector] = useState(PRODUCT_VECTORS[0]);
  const [tone, setTone] = useState("Urgent");
  const [platform, setPlatform] = useState("WhatsApp");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [history, refreshHistory] = useStorageList("script:");
  const resultRef = useRef(null);

  const [usageCount, setUsageCount] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [usageLoaded, setUsageLoaded] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  // ---- Infrastructure: auth session + CRM state (Phases 1–3) ----
  const [session, setSession] = useState(null); // { accessToken, user }
  const [activeTab, setActiveTab] = useState("generate"); // generate | customers
  const [customers, setCustomers] = useState([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [crmView, setCrmView] = useState("dashboard"); // dashboard | add | detail
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [crmFilterStatus, setCrmFilterStatus] = useState("All");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerProduct, setNewCustomerProduct] = useState("");
  const [crmObjectionText, setCrmObjectionText] = useState("");
  const [crmObjectionResponse, setCrmObjectionResponse] = useState("");
  const [crmFollowUpDays, setCrmFollowUpDays] = useState(3);
  const [crmError, setCrmError] = useState("");
  const [crmGenLoading, setCrmGenLoading] = useState(false);
  const [crmGenRootCause, setCrmGenRootCause] = useState("");

  useEffect(() => {
    if (!session) return;
    if (session.isDemo) { setCustomersLoaded(true); return; }
    (async () => {
      try {
        const data = await sbGetCustomers(session.accessToken);
        setCustomers(data);
      } catch (e) {
        setCrmError(e.message);
      } finally {
        setCustomersLoaded(true);
      }
    })();
  }, [session]);

  async function refreshCustomers() {
    try {
      const data = await sbGetCustomers(session.accessToken);
      setCustomers(data);
    } catch (e) {
      setCrmError(e.message);
    }
  }

  async function handleAddCustomer() {
    if (!newCustomerName.trim()) return;
    try {
      await sbAddCustomer(session.accessToken, session.user.id, {
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
        product: newCustomerProduct.trim(),
      });
      setNewCustomerName(""); setNewCustomerPhone(""); setNewCustomerProduct("");
      setCrmView("dashboard");
      await refreshCustomers();
    } catch (e) {
      setCrmError(e.message);
    }
  }

  async function handleUpdateCustomerStatus(customerId, status) {
    try {
      await sbUpdateCustomer(session.accessToken, customerId, { status, last_contact_date: new Date().toISOString().slice(0, 10) });
      await refreshCustomers();
    } catch (e) {
      setCrmError(e.message);
    }
  }

  async function generateObjectionForCustomer(customer) {
    if (!crmObjectionText.trim() || crmGenLoading) return;
    setCrmGenLoading(true);
    setCrmError("");

    const selectedDemoObj = DEMOGRAPHICS.find((d) => d.id === demographic) || DEMOGRAPHICS[0];
    const pastObjections = (customer.objections || []).slice(-5);
    const historyBlock = pastObjections.length
      ? pastObjections.map((o, i) =>
          `${i + 1}. They said: "${o.objection_text}"${o.response_text ? ` → We responded: "${o.response_text}"` : ""}`
        ).join("\n")
      : "No prior objections logged for this customer yet.";

    const prompt = `You are an expert sales, persuasion, and objection-deconstruction engine. A business owner is replying to the SAME customer they've dealt with before. Use that customer's full history so far to make this response smarter than a first-contact reply — reference what's already been tried, and don't repeat an angle that clearly hasn't closed the deal yet.

[CUSTOMER HISTORY WITH THIS BUSINESS]
${historyBlock}

[TARGET DEMOGRAPHIC PROFILE]
Target Demographic: ${selectedDemoObj.label} (${selectedDemoObj.sub})
Core Emotional Driver: ${selectedDemoObj.trigger}
Known Pattern: ${selectedDemoObj.objectionLens}
Product Type: ${productVector}

[NEW OBJECTION FROM THIS CUSTOMER]
"${crmObjectionText.trim()}"

Business name: ${business || customer.name || "the business"}
Product / service: ${product || customer.product || "not specified"}
Price / price list (if known): ${price || "not specified"}

[INSTRUCTION]
1. If this customer has objected before, name what's different or escalated this time, and adjust the approach — do not send a near-duplicate of a past response that already failed to close them.
2. Validate the real emotional root cause behind this specific objection, using the demographic pattern as a guide.
3. Reframe cost/friction as an investment in their identity transformation — never suggest a discount.
4. Write a word-for-word counter-script tailored to this demographic's core motivation.
5. Tone: confident, warm, direct — like someone who remembers this exact customer's whole conversation, not a stranger.

CRITICAL PRICE RULE: If a price is given above, state it exactly, word for word. Never invent one.

Return ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "rootCause": "one or two sentences naming the emotional root cause, referencing history if relevant",
  "response": "the exact word-for-word counter-script the owner should send back, ready to copy and paste"
}`;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, max_tokens: 600 }),
      });
      const data = await res.json();
      const textBlock = (data.content || []).find((b) => b.type === "text");
      const raw = textBlock ? textBlock.text : "";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setCrmObjectionResponse(parsed.response || "");
      setCrmGenRootCause(parsed.rootCause || "");
    } catch (e) {
      setCrmError("Couldn't generate a response. Try again, or write one manually below.");
    } finally {
      setCrmGenLoading(false);
    }
  }

  async function handleLogObjection(customerId) {
    if (!crmObjectionText.trim()) return;
    try {
      await sbLogObjection(session.accessToken, session.user.id, customerId, {
        objectionText: crmObjectionText.trim(),
        responseText: crmObjectionResponse.trim(),
        demographic,
        productVector,
      });
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + Number(crmFollowUpDays));
      await sbUpdateCustomer(session.accessToken, customerId, {
        status: "Objection Handled",
        last_contact_date: new Date().toISOString().slice(0, 10),
        follow_up_date: followUpDate.toISOString().slice(0, 10),
      });
      setCrmObjectionText(""); setCrmObjectionResponse(""); setCrmGenRootCause("");
      await refreshCustomers();
    } catch (e) {
      setCrmError(e.message);
    }
  }

  function crmDaysBetween(dateStr) {
    const today = new Date(new Date().toISOString().slice(0, 10));
    const target = new Date(dateStr);
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
  }


  const [customObjection, setCustomObjection] = useState("");
  const [objectionResult, setObjectionResult] = useState(null);
  const [objectionLoading, setObjectionLoading] = useState(false);
  const [objectionError, setObjectionError] = useState("");
  const objectionResultRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const rawCount = localStorage.getItem("usage:count");
        const u = rawCount !== null ? { value: rawCount } : null;
        setUsageCount(u && u.value ? parseInt(u.value, 10) || 0 : 0);
      } catch (e) { setUsageCount(0); }
      try {
        const rawUnlocked = localStorage.getItem("usage:unlocked");
        const p = rawUnlocked !== null ? { value: rawUnlocked } : null;
        setUnlocked(p && p.value === "true");
      } catch (e) { setUnlocked(false); }
      setUsageLoaded(true);
    })();
  }, []);

  const remaining = Math.max(0, FREE_LIMIT - usageCount);
  const canGenerate = business.trim() && product.trim() && !loading && usageLoaded;

  async function unlockPlan() {
    try { localStorage.setItem("usage:unlocked", "true"); } catch (e) {}
    setUnlocked(true);
    setShowPaywall(false);
  }

  async function generateObjectionResponse() {
    if (!customObjection.trim() || objectionLoading) return;

    if (!TESTING_UNLIMITED && !unlocked && usageCount >= FREE_LIMIT) {
      setShowPaywall(true);
      return;
    }

    setObjectionLoading(true);
    setObjectionError("");
    setObjectionResult(null);

    const selectedDemoObj = DEMOGRAPHICS.find((d) => d.id === demographic) || DEMOGRAPHICS[0];

    const prompt = `You are an expert sales, persuasion, and objection-deconstruction engine, built on direct-response principles. A business owner has pasted in an exact objection, question, or pushback from a real prospect. Your job is to deconstruct it and hand back the exact response the owner should send.

[OBJECTION CONTEXT]
Prospect's Objection: "${customObjection}"
Target Demographic: ${selectedDemoObj.label} (${selectedDemoObj.sub})
Core Emotional Driver: ${selectedDemoObj.trigger}
Known Pattern for This Demographic: ${selectedDemoObj.objectionLens}
Product Type: ${productVector}

[OBJECTION-HANDLING INSTRUCTION]
Deconstruct the objection using direct-response principles:
1. VALIDATE THE EMOTIONAL ROOT CAUSE — identify the real fear beneath the surface words (fear of looking foolish, loss of status, lack of self-trust, risk to peace of mind, fear of wasting money) using the demographic pattern above as your guide, but adapt it to what this specific prospect actually wrote.
2. REFRAME THE COST — position the price or friction not as a loss, but as an investment in the identity transformation this demographic actually wants (see Core Emotional Driver above). Never suggest a discount — stack value, proof, or guarantees instead.
3. WRITE A WORD-FOR-WORD COUNTER-SCRIPT tailored specifically to this demographic's core motivation: ${selectedDemoObj.counterFocus}
4. Include real risk reversal (guarantee, trial, or proof) where it genuinely applies, and only real urgency if it genuinely applies — never fake either.
5. Tone: confident, warm, direct — like a trusted advisor who understands exactly what's going on beneath the objection, not a pushy script-reader. Sound like a real person replying on WhatsApp.

Business name: ${business || "the business"}
Product / service: ${product || "not specified"}
Price / price list (if known — may list multiple items): ${price || "not specified"}

CRITICAL PRICE RULE: If a price or price list is given above, state the exact price(s) directly in your response, word for word. Never replace a real number with vague phrases. Only omit price if none was provided.

Return ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "rootCause": "one or two sentences naming the specific emotional root cause behind THIS prospect's exact words, using the demographic pattern as a guide",
  "reframe": "one sentence reframing the cost/friction as an investment in their identity transformation, specific to this demographic's core motivation",
  "response": "the exact word-for-word counter-script the owner should send back, ready to copy and paste",
  "shorterAlternative": "a shorter, punchier version of the same response for a quick reply"
}`;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, max_tokens: 700 }),
      });
      const data = await res.json();
      const textBlock = (data.content || []).find((b) => b.type === "text");
      const raw = textBlock ? textBlock.text : "";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setObjectionResult(parsed);

      if (!unlocked) {
        const newCount = usageCount + 1;
        setUsageCount(newCount);
        try { localStorage.setItem("usage:count", String(newCount)); } catch (e) {}
      }

      setTimeout(() => objectionResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setObjectionError("Couldn't generate a response. Try again.");
    } finally {
      setObjectionLoading(false);
    }
  }

  async function generate() {
    if (!canGenerate) return;
    if (!TESTING_UNLIMITED && !unlocked && usageCount >= FREE_LIMIT) {
      setShowPaywall(true);
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);

    const selectedDemo = DEMOGRAPHICS.find((d) => d.id === demographic) || DEMOGRAPHICS[0];

    const prompt = `You are an expert sales, persuasion, and offer-architecture engine, built on the following framework. Apply ALL of these principles when writing the output — do not skip any:

1. TARGET THE PAIN — Do not lead with surface features. Identify the underlying pain point (tied to money, time, status, health, or relationships) that makes this customer's current situation costly or frustrating, and speak directly to that.
2. SHOW A CLEAR TRANSFORMATION — Map out Before vs. After: what the customer is stuck with right now, versus the exact, frictionless result they get after buying.
3. VALUE STACKING FOR OBJECTIONS — When handling the "too expensive" or hesitation objections, NEVER offer a cheap discount. Instead stack strategic bonuses, faster delivery, or extra resources so the core price feels small next to the total value pile.
4. RISK REVERSAL — Build in a guarantee, trial, or proof mechanism that shifts risk off the buyer and onto the seller.
5. NATURAL URGENCY — Use only real, believable urgency (actual stock limits, time windows, logistics) so "later" doesn't become "never." No fake countdowns.
6. ONE-SENTENCE COMPRESSION — Also produce a single compressed sentence using exactly this architecture: "For [price], you get [core offer] plus [stack of extras], with [guarantee] so there's no risk, and [real urgency reason] why now matters."

TARGET DEMOGRAPHIC PSYCHOLOGICAL PROFILE — this must shape the entire pitch, not just be mentioned in passing:
Target Demographic: ${selectedDemo.label} (${selectedDemo.sub})
Primary Emotional Driver: ${selectedDemo.trigger}
Product Type: ${productVector}

Speak directly to the emotional identity shift: how this makes the buyer feel, how others perceive them, and the ultimate transformation — not just what the product does. Match tone specifically to the demographic above (e.g. status/leverage/edge for men, confidence/alignment/self-worth for women, protection/peace-of-mind/security for parents, future/mobility/ambition for youth, broad practical value for unisex/universal). Avoid generic features entirely.

Tone: persuasive, clear, confident, direct. No fluff. Make the offer so good the customer feels stupid saying no.

Business name: ${business}
Product / service: ${product}
Price / price list (if provided — may list multiple items, one per line as NAME - PRICE): ${price || "not specified — do not invent a price, omit price from compression if not given"}
Target customer: ${customer || "general customers"}
Tone style requested: ${tone}
Platform: ${platform}

CRITICAL PRICE RULE: If a price or price list is provided above, you MUST state the exact price(s) given, word for word as written, directly in the pitch. Never replace a real number with vague phrases like "unbeatable prices" or "prices that make retail look like a scam." If multiple items with prices are listed, mention each item with its own exact price in the pitch. Only omit prices entirely if none were provided.

Return ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "painPoint": "one sharp sentence naming the real underlying pain this customer feels",
  "pitch": "a short punchy sales pitch (3-5 sentences) that targets the pain and shows the transformation, ready to post or send, in the requested tone, for the requested platform",
  "transformation": {
    "before": "a short sentence describing the customer's frustrating current state",
    "after": "a short sentence describing the frictionless result after buying"
  },
  "objections": [
    {"objection": "the 'too expensive' or hesitation objection", "response": "a response using value stacking — bonuses/extras added, never a discount"},
    {"objection": "a second common objection", "response": "a short persuasive response"},
    {"objection": "a third common objection", "response": "a short persuasive response"}
  ],
  "guarantee": "a specific risk-reversal line (guarantee, trial, or proof) that removes risk from the buyer",
  "urgency": "one real, believable urgency line (no fake countdowns)",
  "followup": "a short follow-up message to send a day later to someone who showed interest but didn't buy",
  "compression": "the one-sentence compression using exactly the architecture: For [price], you get [core offer] plus [stack of extras], with [guarantee] so there's no risk, and [real urgency reason] why now matters."
}`;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, max_tokens: 1000 }),
      });
      const data = await response.json();
      const textBlock = (data.content || []).find((b) => b.type === "text");
      const raw = textBlock ? textBlock.text : "";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);

      const record = {
        id: `script_${Date.now()}`,
        ts: Date.now(),
        business, product, customer, price, tone, platform,
        ...parsed,
      };
      try {
        localStorage.setItem(`script:${record.id}`, JSON.stringify(record));
        refreshHistory();
      } catch (e) {}

      if (!unlocked) {
        const newCount = usageCount + 1;
        setUsageCount(newCount);
        try { localStorage.setItem("usage:count", String(newCount)); } catch (e) {}
      }

      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setError("Something went wrong generating your script. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteRecord(id) {
    try {
      localStorage.removeItem(`script:${id}`);
      refreshHistory();
    } catch (e) {}
  }

  function loadRecord(r) {
    setBusiness(r.business);
    setProduct(r.product);
    setCustomer(r.customer);
    setPrice(r.price || "");
    setTone(r.tone);
    setPlatform(r.platform);
    setResult({
      painPoint: r.painPoint,
      pitch: r.pitch,
      transformation: r.transformation,
      objections: r.objections,
      guarantee: r.guarantee,
      urgency: r.urgency,
      followup: r.followup,
      compression: r.compression,
    });
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }

  if (!session) {
    return <LoginScreen onLogin={setSession} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap');
        .display { font-family: 'Archivo Black', sans-serif; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        ::selection { background: #FF6B1A; color: #0B1F3A; }
      `}</style>

      {/* Header */}
      <header className="border-b border-slate-700 px-6 py-5 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-orange-500 flex items-center justify-center">
            <Zap size={17} className="text-slate-900" strokeWidth={2.5} />
          </div>
          <div>
            <div className="display text-[15px] tracking-tight leading-none">STRATPITCH</div>
            <div className="mono text-[9px] text-slate-400 tracking-widest mt-0.5">STRATEGIC SALES &amp; OBJECTION HANDLING</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {TESTING_UNLIMITED ? (
            <div className="flex items-center gap-1.5 mono text-[10px] text-orange-500 tracking-wider">
              <Sparkles size={11} /> TESTING MODE — UNLIMITED
            </div>
          ) : unlocked ? (
            <div className="flex items-center gap-1.5 mono text-[10px] text-emerald-500 tracking-wider">
              <Sparkles size={11} /> UNLIMITED PLAN
            </div>
          ) : (
            <div className="mono text-[10px] text-slate-400 tracking-wider">
              {remaining} FREE SCRIPT{remaining === 1 ? "" : "S"} LEFT
            </div>
          )}
          <button onClick={() => setSession(null)} className="text-slate-400 hover:text-white" title="Log out">
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Tab nav */}
      <div className="border-b border-slate-700 px-6 flex gap-1 bg-slate-900/95 sticky top-[73px] z-10">
        <button
          onClick={() => setActiveTab("generate")}
          className={`text-[12.5px] font-medium px-4 py-3 border-b-2 transition-colors ${activeTab === "generate" ? "border-orange-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}
        >
          Generate
        </button>
        <button
          onClick={() => setActiveTab("customers")}
          className={`flex items-center gap-1.5 text-[12.5px] font-medium px-4 py-3 border-b-2 transition-colors ${activeTab === "customers" ? "border-orange-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}
        >
          <Users size={13} /> Customers
        </button>
      </div>

      {activeTab === "generate" && (
      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="mb-10">
          <div className="mono text-[11px] text-orange-500 tracking-widest mb-3">FROM PRODUCT TO PITCH IN SECONDS</div>
          <h1 className="display text-[32px] sm:text-[40px] leading-[1.05] tracking-tight mb-3">
            Turn what you sell<br />into words that sell it.
          </h1>
          <p className="text-slate-300 text-[15px] leading-relaxed max-w-lg">
            Tell it what you're selling. Get a ready-to-send sales pitch, objection
            handlers, and a follow-up message — built for how you actually sell.
          </p>
        </div>

        {/* Target Audience & Psychological Profiler */}
        <div className="mb-8">
          <div className="mono text-[11px] text-orange-500 tracking-widest mb-3">STEP 1 · TARGET AUDIENCE PROFILER</div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <label className="mono text-[10px] text-slate-400 tracking-widest block mb-2">A. CORE DEMOGRAPHIC TARGET</label>
            <div className="flex flex-wrap gap-2 mb-5">
              {DEMOGRAPHICS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDemographic(d.id)}
                  className={`text-[12.5px] px-3.5 py-2 rounded-full border transition-colors ${
                    demographic === d.id
                      ? "bg-orange-500 border-orange-500 text-slate-900 font-semibold"
                      : "border-slate-600 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  {d.label} <span className={demographic === d.id ? "text-slate-900/70" : "text-slate-500"}>· {d.sub}</span>
                </button>
              ))}
            </div>

            <label className="mono text-[10px] text-slate-400 tracking-widest block mb-2">B. PRODUCT VECTOR</label>
            <select
              value={productVector}
              onChange={(e) => setProductVector(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-orange-500 transition-colors mb-5"
            >
              {PRODUCT_VECTORS.map((v) => <option key={v}>{v}</option>)}
            </select>

            <label className="mono text-[10px] text-slate-400 tracking-widest block mb-2">C. EMOTIONAL DELTA (AUTO-DETECTED)</label>
            <div className="bg-slate-900 border border-orange-500/40 rounded-lg p-3.5">
              <p className="text-[12.5px] text-slate-300 leading-relaxed">
                <span className="text-orange-500 font-semibold">Primary trigger: </span>
                {DEMOGRAPHICS.find((d) => d.id === demographic)?.trigger}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="mono text-[11px] text-orange-500 tracking-widest mb-3">STEP 2 · WHAT YOU'RE SELLING</div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8">
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="mono text-[10px] text-slate-400 tracking-widest block mb-1.5">BUSINESS NAME</label>
              <input
                value={business}
                onChange={(e) => setBusiness(e.target.value)}
                placeholder="e.g. Stunners"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-orange-500 transition-colors placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="mono text-[10px] text-slate-400 tracking-widest block mb-1.5">TARGET CUSTOMER</label>
              <input
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="e.g. runners aged 20-35"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-orange-500 transition-colors placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="mono text-[10px] text-slate-400 tracking-widest block mb-1.5">PRODUCT OR SERVICE</label>
            <textarea
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="e.g. Adidas Adios Pro 3 running shoes, limited stock, first 20 buyers get free socks"
              rows={2}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-orange-500 transition-colors placeholder:text-slate-500 resize-none"
            />
          </div>

          <div className="mb-4">
            <label className="mono text-[10px] text-slate-400 tracking-widest block mb-1.5">PRICE / PRICE LIST (OPTIONAL)</label>
            <textarea
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={"e.g. K1,200\nor for multiple items:\niPhone 13 - K3,500\nPixel 7 Pro - K4,000\niPhone 11 Pro Max - K2,800"}
              rows={3}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-orange-500 transition-colors placeholder:text-slate-500 resize-none"
            />
            <p className="mono text-[9px] text-slate-500 mt-1.5 leading-relaxed">
              Selling more than one item? List each on its own line: NAME - PRICE
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="mono text-[10px] text-slate-400 tracking-widest block mb-1.5">TONE</label>
              <div className="flex gap-2">
                {TONES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`flex-1 text-[13px] py-2 rounded-lg border transition-colors ${
                      tone === t
                        ? "bg-orange-500 border-orange-500 text-slate-900 font-semibold"
                        : "border-slate-600 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mono text-[10px] text-slate-400 tracking-widest block mb-1.5">PLATFORM</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-orange-500 transition-colors"
              >
                {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={generate}
            disabled={!canGenerate || (!business.trim() || !product.trim())}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 disabled:bg-slate-600 disabled:text-slate-400 text-slate-900 font-semibold py-3 rounded-lg transition-colors hover:bg-orange-400 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : !TESTING_UNLIMITED && !unlocked && usageCount >= FREE_LIMIT ? (
              <Lock size={15} />
            ) : (
              <Send size={15} />
            )}
            {loading
              ? "Writing your pitch..."
              : !TESTING_UNLIMITED && !unlocked && usageCount >= FREE_LIMIT
              ? "Unlock unlimited scripts"
              : "Generate sales script"}
          </button>
          {!unlocked && usageCount < FREE_LIMIT && (
            <p className="mono text-[10px] text-slate-400 text-center mt-2 tracking-wide">
              {remaining} FREE SCRIPT{remaining === 1 ? "" : "S"} REMAINING
            </p>
          )}
          {error && <div className="mt-3 text-[13px] text-orange-500">{error}</div>}
        </div>

        {/* Result */}
        {result && (
          <div ref={resultRef} className="space-y-4 mb-12">
            <div className="mono text-[11px] text-emerald-500 tracking-widest">READY TO SEND</div>

            {result.painPoint && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-white mb-2">
                  <Target size={15} className="text-orange-500" /> The Real Pain Point
                </div>
                <p className="text-[13.5px] leading-relaxed text-slate-200">{result.painPoint}</p>
              </div>
            )}

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
                  <MessageCircle size={15} className="text-orange-500" /> Sales Pitch
                </div>
                <CopyButton text={result.pitch} />
              </div>
              <p className="text-[14px] leading-relaxed text-slate-200 whitespace-pre-wrap">{result.pitch}</p>
            </div>

            {result.transformation && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-white mb-3">
                  <Repeat size={15} className="text-orange-500" /> Before → After
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                    <div className="mono text-[9px] text-slate-400 tracking-widest mb-1.5">BEFORE</div>
                    <p className="text-[13px] text-slate-200 leading-relaxed">{result.transformation.before}</p>
                  </div>
                  <div className="bg-slate-900 border border-emerald-500/40 rounded-lg p-3">
                    <div className="mono text-[9px] text-emerald-500 tracking-widest mb-1.5">AFTER</div>
                    <p className="text-[13px] text-slate-200 leading-relaxed">{result.transformation.after}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-white mb-3">
                <ShieldAlert size={15} className="text-orange-500" /> Objection Handlers <span className="mono text-[9px] text-slate-400 font-normal">(value-stacked, no discounts)</span>
              </div>
              <div className="space-y-3">
                {(result.objections || []).map((o, i) => (
                  <div key={i} className="border-l-2 border-slate-600 pl-3">
                    <div className="text-[12.5px] text-slate-400 italic mb-1">"{o.objection}"</div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13.5px] text-slate-200 leading-relaxed">{o.response}</p>
                      <CopyButton text={o.response} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(result.guarantee || result.urgency) && (
              <div className="grid sm:grid-cols-2 gap-4">
                {result.guarantee && (
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-white mb-2">
                      <ShieldCheck size={15} className="text-emerald-500" /> Risk Reversal
                    </div>
                    <p className="text-[13px] text-slate-200 leading-relaxed">{result.guarantee}</p>
                  </div>
                )}
                {result.urgency && (
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-white mb-2">
                      <Clock size={15} className="text-orange-500" /> Natural Urgency
                    </div>
                    <p className="text-[13px] text-slate-200 leading-relaxed">{result.urgency}</p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
                  <ArrowRight size={15} className="text-orange-500" /> Follow-Up Message
                </div>
                <CopyButton text={result.followup} />
              </div>
              <p className="text-[14px] leading-relaxed text-slate-200 whitespace-pre-wrap">{result.followup}</p>
            </div>

            {result.compression && (
              <div className="bg-gradient-to-br from-orange-500/10 to-slate-800 border border-orange-500/40 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
                    <Sparkles size={15} className="text-orange-500" /> One-Sentence Offer
                  </div>
                  <CopyButton text={result.compression} />
                </div>
                <p className="text-[14.5px] leading-relaxed text-white font-medium">{result.compression}</p>
              </div>
            )}
          </div>
        )}

        {/* Custom Objection Handler */}
        <div className="mb-10">
          <div className="mono text-[11px] text-orange-500 tracking-widest mb-3">GOT A REAL CUSTOMER MESSAGE?</div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert size={16} className="text-orange-500" />
              <h2 className="display text-[16px]">Handle This Exact Objection</h2>
            </div>
            <p className="text-[13px] text-slate-300 leading-relaxed mb-4">
              Paste in the customer's actual question or pushback — word for word — and get a
              ready-to-send reply built the same way: real pain, value stacking, risk reversal,
              no fake urgency.
            </p>

            <label className="mono text-[10px] text-slate-400 tracking-widest block mb-1.5">CUSTOMER'S MESSAGE</label>
            <textarea
              value={customObjection}
              onChange={(e) => setCustomObjection(e.target.value)}
              placeholder='e.g. "K1,200 is too much, I saw the same shoes cheaper at another shop"'
              rows={3}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-orange-500 transition-colors placeholder:text-slate-500 resize-none mb-3"
            />

            <button
              onClick={generateObjectionResponse}
              disabled={!customObjection.trim() || objectionLoading}
              className="w-full flex items-center justify-center gap-2 bg-orange-500 disabled:bg-slate-600 disabled:text-slate-400 text-slate-900 font-semibold py-3 rounded-lg transition-colors hover:bg-orange-400 disabled:cursor-not-allowed"
            >
              {objectionLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : !TESTING_UNLIMITED && !unlocked && usageCount >= FREE_LIMIT ? (
                <Lock size={15} />
              ) : (
                <Send size={15} />
              )}
              {objectionLoading
                ? "Writing your response..."
                : !TESTING_UNLIMITED && !unlocked && usageCount >= FREE_LIMIT
                ? "Unlock unlimited responses"
                : "Generate response"}
            </button>
            {objectionError && <div className="mt-3 text-[13px] text-orange-500">{objectionError}</div>}

            {objectionResult && (
              <div ref={objectionResultRef} className="mt-5 space-y-3">
                <div className="border-l-2 border-orange-500 pl-3">
                  <div className="mono text-[9px] text-slate-400 tracking-widest mb-1">EMOTIONAL ROOT CAUSE</div>
                  <p className="text-[13px] text-slate-200 leading-relaxed">{objectionResult.rootCause}</p>
                </div>

                {objectionResult.reframe && (
                  <div className="border-l-2 border-slate-600 pl-3">
                    <div className="mono text-[9px] text-slate-400 tracking-widest mb-1">THE REFRAME</div>
                    <p className="text-[13px] text-slate-200 leading-relaxed">{objectionResult.reframe}</p>
                  </div>
                )}

                <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="mono text-[10px] text-emerald-500 tracking-widest">SEND THIS</div>
                    <CopyButton text={objectionResult.response} />
                  </div>
                  <p className="text-[14px] leading-relaxed text-white whitespace-pre-wrap">{objectionResult.response}</p>
                </div>

                {objectionResult.shorterAlternative && (
                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="mono text-[10px] text-slate-400 tracking-widest">SHORTER VERSION</div>
                      <CopyButton text={objectionResult.shorterAlternative} />
                    </div>
                    <p className="text-[13.5px] leading-relaxed text-slate-200 whitespace-pre-wrap">{objectionResult.shorterAlternative}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div>
            <div className="mono text-[11px] text-slate-400 tracking-widest mb-3">SAVED SCRIPTS ({history.length})</div>
            <div className="space-y-2">
              {history.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 hover:border-slate-600 transition-colors"
                >
                  <button onClick={() => loadRecord(r)} className="text-left flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium truncate">{r.business} — {r.product}</div>
                    <div className="mono text-[10px] text-slate-400 mt-0.5">{r.tone} · {r.platform}</div>
                  </button>
                  <button
                    onClick={() => deleteRecord(r.id)}
                    className="text-slate-400 hover:text-orange-500 transition-colors p-1.5"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      )}

      {activeTab === "customers" && (
        <main className="max-w-2xl mx-auto px-6 py-8">
          {session.isDemo ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
              <Users size={22} className="text-slate-500 mx-auto mb-3" />
              <p className="text-[13.5px] text-slate-300 leading-relaxed mb-1">
                The Customers tab needs a real Supabase connection to work.
              </p>
              <p className="text-[12px] text-slate-500 leading-relaxed">
                This chat preview can't reach outside services like Supabase — test this tab
                on your real deployed website instead, where login will work normally.
              </p>
            </div>
          ) : (
          <>
          {crmError && (
            <div className="mb-4 bg-orange-500/10 border border-orange-500/40 rounded-lg p-3 text-[12.5px] text-orange-400">
              {crmError}
            </div>
          )}

          {!customersLoaded ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-orange-500" size={24} />
            </div>
          ) : crmView === "dashboard" ? (
            <>
              {(() => {
                const dueToday = customers.filter((c) => c.follow_up_date && crmDaysBetween(c.follow_up_date) <= 0 && c.status !== "Won" && c.status !== "Lost");
                const won = customers.filter((c) => c.status === "Won");
                const visible = crmFilterStatus === "All" ? customers : customers.filter((c) => c.status === crmFilterStatus);
                return (
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                        <div className="text-[22px] font-bold">{customers.length}</div>
                        <div className="text-[10px] text-slate-400 tracking-wide font-mono">TOTAL CUSTOMERS</div>
                      </div>
                      <div className="bg-slate-800 border border-orange-500/40 rounded-xl p-4">
                        <div className="text-[22px] font-bold text-orange-500">{dueToday.length}</div>
                        <div className="text-[10px] text-slate-400 tracking-wide font-mono">FOLLOW-UPS DUE</div>
                      </div>
                      <div className="bg-slate-800 border border-emerald-600/40 rounded-xl p-4">
                        <div className="text-[22px] font-bold text-emerald-500">{won.length}</div>
                        <div className="text-[10px] text-slate-400 tracking-wide font-mono">DEALS WON</div>
                      </div>
                    </div>

                    {dueToday.length > 0 && (
                      <div className="mb-6 bg-orange-500/10 border border-orange-500/40 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle size={15} className="text-orange-500" />
                          <span className="text-[13px] font-semibold">Follow up with these today</span>
                        </div>
                        <div className="space-y-1.5">
                          {dueToday.map((c) => (
                            <button key={c.id} onClick={() => { setSelectedCustomerId(c.id); setCrmView("detail"); }}
                              className="w-full flex items-center justify-between text-[13px] text-slate-200 hover:text-white py-1">
                              <span>{c.name} — {c.product}</span>
                              <ChevronRight size={14} className="text-slate-500" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-3">
                      <div className="mono text-[11px] text-orange-500 tracking-widest">CUSTOMERS</div>
                      <button onClick={() => setCrmView("add")} className="flex items-center gap-1 text-[12px] bg-orange-500 text-slate-900 font-semibold px-3 py-1.5 rounded-lg hover:bg-orange-400 transition-colors">
                        <Plus size={14} /> Add Customer
                      </button>
                    </div>

                    <div className="flex gap-1.5 mb-4 flex-wrap">
                      {["All", "New", "Contacted", "Objection Handled", "Won", "Lost"].map((s) => (
                        <button key={s} onClick={() => setCrmFilterStatus(s)}
                          className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${crmFilterStatus === s ? "bg-slate-700 border-slate-500 text-white" : "border-slate-700 text-slate-400 hover:border-slate-600"}`}>
                          {s}
                        </button>
                      ))}
                    </div>

                    {visible.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-[13px]">
                        No customers yet. Add your first one — it'll be saved to your account permanently.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {visible.map((c) => {
                          const overdue = c.follow_up_date && crmDaysBetween(c.follow_up_date) < 0 && c.status !== "Won" && c.status !== "Lost";
                          const statusColors = {
                            "New": "bg-slate-600 text-slate-100",
                            "Contacted": "bg-blue-600 text-blue-50",
                            "Objection Handled": "bg-orange-500 text-slate-900",
                            "Won": "bg-emerald-600 text-emerald-50",
                            "Lost": "bg-red-700 text-red-50",
                          };
                          return (
                            <button key={c.id} onClick={() => { setSelectedCustomerId(c.id); setCrmView("detail"); }}
                              className="w-full text-left bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg p-4 transition-colors">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[14px] font-semibold">{c.name}</span>
                                <span className={`text-[9.5px] font-mono tracking-wide px-2 py-0.5 rounded-full ${statusColors[c.status]}`}>{c.status.toUpperCase()}</span>
                              </div>
                              <div className="text-[12px] text-slate-400">{c.product || "No product specified"}</div>
                              <div className="flex items-center gap-3 mt-1.5 text-[10.5px] text-slate-500 font-mono">
                                <span>Last contact: {c.last_contact_date}</span>
                                {c.follow_up_date && (
                                  <span className={overdue ? "text-red-400" : "text-slate-500"}>
                                    Follow-up: {c.follow_up_date} {overdue && "(overdue)"}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          ) : crmView === "add" ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <button onClick={() => setCrmView("dashboard")} className="flex items-center gap-1 text-[12px] text-slate-400 hover:text-white mb-4">
                <ArrowLeft size={14} /> Back
              </button>
              <h2 className="text-[18px] font-bold mb-4">Add New Customer</h2>
              <label className="text-[10px] text-slate-400 tracking-widest block mb-1.5 font-mono">NAME</label>
              <input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="e.g. Chanda Mwansa"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-orange-500 mb-4 placeholder:text-slate-500" />
              <label className="text-[10px] text-slate-400 tracking-widest block mb-1.5 font-mono">PHONE (OPTIONAL)</label>
              <input value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} placeholder="e.g. 0977 123 456"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-orange-500 mb-4 placeholder:text-slate-500" />
              <label className="text-[10px] text-slate-400 tracking-widest block mb-1.5 font-mono">PRODUCT / INTEREST</label>
              <input value={newCustomerProduct} onChange={(e) => setNewCustomerProduct(e.target.value)} placeholder="e.g. iPhone 13, 128GB"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-orange-500 mb-5 placeholder:text-slate-500" />
              <button onClick={handleAddCustomer} disabled={!newCustomerName.trim()}
                className="w-full bg-orange-500 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold py-3 rounded-lg hover:bg-orange-400 transition-colors">
                Save Customer
              </button>
            </div>
          ) : (
            (() => {
              const selected = customers.find((c) => c.id === selectedCustomerId);
              if (!selected) return null;
              const statusColors = {
                "New": "bg-slate-600 text-slate-100",
                "Contacted": "bg-blue-600 text-blue-50",
                "Objection Handled": "bg-orange-500 text-slate-900",
                "Won": "bg-emerald-600 text-emerald-50",
                "Lost": "bg-red-700 text-red-50",
              };
              const objections = selected.objections || [];
              return (
                <div>
                  <button onClick={() => { setCrmView("dashboard"); setSelectedCustomerId(null); }} className="flex items-center gap-1 text-[12px] text-slate-400 hover:text-white mb-4">
                    <ArrowLeft size={14} /> Back
                  </button>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-[20px] font-bold">{selected.name}</h2>
                      <div className="text-[12px] text-slate-400">{selected.product} {selected.phone && `· ${selected.phone}`}</div>
                    </div>
                    <span className={`text-[10px] font-mono tracking-wide px-2.5 py-1 rounded-full ${statusColors[selected.status]}`}>{selected.status.toUpperCase()}</span>
                  </div>

                  <div className="flex gap-2 mb-6">
                    <button onClick={() => handleUpdateCustomerStatus(selected.id, "Won")}
                      className="flex items-center gap-1.5 text-[12px] bg-emerald-600 text-emerald-50 font-semibold px-3 py-2 rounded-lg hover:bg-emerald-500 transition-colors">
                      <CheckCircle2 size={14} /> Mark Won
                    </button>
                    <button onClick={() => handleUpdateCustomerStatus(selected.id, "Lost")}
                      className="flex items-center gap-1.5 text-[12px] bg-red-700 text-red-50 font-semibold px-3 py-2 rounded-lg hover:bg-red-600 transition-colors">
                      <XCircle size={14} /> Mark Lost
                    </button>
                  </div>

                  <div className="mono text-[11px] text-orange-500 tracking-widest mb-2">OBJECTION HISTORY ({objections.length})</div>
                  {objections.length === 0 ? (
                    <div className="text-[13px] text-slate-500 mb-5">No objections logged yet.</div>
                  ) : (
                    <div className="space-y-2 mb-5">
                      {objections.map((o) => (
                        <div key={o.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3.5">
                          <div className="text-[10px] text-slate-500 font-mono mb-1">{new Date(o.created_at).toISOString().slice(0, 10)}</div>
                          <div className="text-[13px] text-slate-200 mb-1.5"><span className="text-slate-400">Objection:</span> {o.objection_text}</div>
                          {o.response_text && <div className="text-[13px] text-slate-300"><span className="text-slate-400">Response sent:</span> {o.response_text}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                    <div className="text-[10px] text-slate-400 tracking-widest mb-2 font-mono">LOG A NEW OBJECTION</div>
                    <textarea value={crmObjectionText} onChange={(e) => setCrmObjectionText(e.target.value)}
                      placeholder="What did they say?" rows={2}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-[13px] outline-none focus:border-orange-500 mb-2 placeholder:text-slate-500 resize-none" />

                    <button
                      onClick={() => generateObjectionForCustomer(selected)}
                      disabled={!crmObjectionText.trim() || crmGenLoading}
                      className="w-full flex items-center justify-center gap-2 border border-orange-500/50 text-orange-500 disabled:border-slate-700 disabled:text-slate-600 font-medium text-[12.5px] py-2 rounded-lg hover:bg-orange-500/10 transition-colors mb-2"
                    >
                      {crmGenLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      {crmGenLoading ? "Reading their history..." : objections.length > 0 ? `Generate response using their ${objections.length}-objection history` : "Generate response"}
                    </button>

                    {crmGenRootCause && (
                      <div className="border-l-2 border-orange-500 pl-3 mb-3">
                        <div className="text-[9px] text-slate-400 tracking-widest mb-1 font-mono">ROOT CAUSE (FACTORING IN HISTORY)</div>
                        <p className="text-[12.5px] text-slate-200 leading-relaxed">{crmGenRootCause}</p>
                      </div>
                    )}

                    <textarea value={crmObjectionResponse} onChange={(e) => setCrmObjectionResponse(e.target.value)}
                      placeholder="What did you respond? (generate above, or write manually)" rows={3}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-[13px] outline-none focus:border-orange-500 mb-3 placeholder:text-slate-500 resize-none" />
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[11px] text-slate-400">Set follow-up reminder in</span>
                      <input type="number" min="1" value={crmFollowUpDays} onChange={(e) => setCrmFollowUpDays(e.target.value)}
                        className="w-14 bg-slate-900 border border-slate-600 rounded-md px-2 py-1 text-[12px] text-center outline-none focus:border-orange-500" />
                      <span className="text-[11px] text-slate-400">days</span>
                    </div>
                    <button onClick={() => handleLogObjection(selected.id)} disabled={!crmObjectionText.trim()}
                      className="w-full flex items-center justify-center gap-2 bg-orange-500 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold py-2.5 rounded-lg hover:bg-orange-400 transition-colors">
                      <MessageCircle size={14} /> Log Objection &amp; Set Follow-Up
                    </button>
                  </div>
                </div>
              );
            })()
          )}
          </>
          )}
        </main>
      )}

      <footer className="border-t border-slate-700 px-6 py-6 text-center mono text-[10px] text-slate-500 tracking-wider">
        © 2026 STRATPITCH. ALL RIGHTS RESERVED. · BUILT FOR HIGH-CONVERTING SALES.
      </footer>

      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}

      {showPaywall && (
        <PaywallModal
          onClose={() => setShowPaywall(false)}
          business={business}
        />
      )}
    </div>
  );
}
