const response = await fetch('http://127.0.0.1:8081/observations');
if (!response.ok) throw new Error('FIXTURE_OBSERVATIONS_FAILED');
console.log(await response.text());
