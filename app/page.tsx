'use client'
import { useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function createIndexAndEmbeddings() {
    try {
      const result = await fetch("/api/setup", {
        method: "POST",
      });
      const json = await result.json();
      console.log(json);
    } catch (error) {
      console.error("error: ", error);
    }
  }

  async function sendQuery() {
    if(!query) return;
    setLoading(true);
    try {
      const result = await fetch("/api/read", {
        method: "POST",
        body: JSON.stringify(query),
        headers: {
          "Content-Type": "application/json",
        },
      });
      const json = await result.json();
      setResult(json.data);
      setLoading(false);
    } catch (error) {
      console.error("error: ", error);
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-between p-24">
      <input className="text-black px-2 py-1" onChange={(e) => setQuery(e.target.value)} />
      <button className="px-7 py-1 rounderd-2xl bg-white text-black mt-2 mb-2" onClick={sendQuery}>Ask AI</button>
      { loading && <p>Asking AI...</p> }
      { result && <p>{result}</p> }
      <button onClick={createIndexAndEmbeddings}>Create Index and Embeddings</button>
    </main>
  );
}
