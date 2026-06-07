async function run() {
  console.log("Sending POST request to local Express server...");
  try {
    const res = await fetch("http://localhost:3000/api/narrativas/audio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer MOCK_TOKEN"
      },
      body: JSON.stringify({
        narrativa_id: "dbdd0c24-0eb4-40d1-8ee1-85a9065c81c2",
        voz: "MALE",
        forcar_regeracao: true
      })
    });

    console.log("Response Status:", res.status);
    console.log("Response Status Text:", res.statusText);
    console.log("Content-Type:", res.headers.get("content-type"));
    
    const text = await res.text();
    console.log("\nRaw Body Response (first 500 chars):");
    console.log(text.slice(0, 500));
  } catch (err: any) {
    console.error("Fetch Error:", err.message);
  }
}

run();
