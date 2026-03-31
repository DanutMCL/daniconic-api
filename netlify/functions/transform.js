exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { imageBase64, mediaType } = JSON.parse(event.body);

    // Étape 1 : Upload l'image sur imgur pour obtenir une URL publique
    const imgurRes = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        'Authorization': 'Client-ID 546c25a59c58ad7',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: imageBase64,
        type: 'base64'
      })
    });
    const imgurData = await imgurRes.json();
    const imageUrl = imgurData.data.link;

    // Étape 2 : Envoyer l'URL à Replicate
    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: "15a3689ee13b0d2616e98820eca31d4c3abcd36672df6afce5cb6feb1d66087d",
        input: {
          image: imageUrl,
          prompt: "beautiful watercolor painting, soft watercolor style, white background, artistic brushstrokes, pastel colors, painted portrait, watercolor splashes",
          negative_prompt: "photo, realistic, photography, sharp edges",
          prompt_strength: 0.75,
          num_inference_steps: 30,
          guidance_scale: 7.5
        }
      })
    });

    const prediction = await startRes.json();
    console.log('Prediction started:', JSON.stringify(prediction));

    let result = prediction;
    let attempts = 0;
    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < 60) {
      await new Promise(r => setTimeout(r, 2000));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: { 'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}` }
      });
      result = await poll.json();
      attempts++;
    }

    console.log('Final result:', JSON.stringify(result));

    if (result.status === 'failed' || !result.output) {
      throw new Error('Échec : ' + JSON.stringify(result));
    }

    const output = Array.isArray(result.output) ? result.output[0] : result.output;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ imageUrl: output })
    };

  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
