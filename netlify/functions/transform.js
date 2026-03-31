exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { imageBase64, mediaType, predictionId } = JSON.parse(event.body);

    // Mode poll : vérifier le statut d'une prédiction existante
    if (predictionId) {
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { 'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}` }
      });
      const result = await pollRes.json();
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      };
    }

    // Mode création : lancer la transformation
    const base64 = imageBase64;
    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: "15a3689ee13b0d2616e98820eca31d4c3abcd36672df6afce5cb6feb1d66087d",
        input: {
          image: `data:${mediaType};base64,${base64}`,
          prompt: "beautiful watercolor painting, soft watercolor style, white background, artistic brushstrokes, pastel colors, painted portrait",
          negative_prompt: "photo, realistic, photography, sharp",
          prompt_strength: 0.75,
          num_inference_steps: 25,
          guidance_scale: 7
        }
      })
    });

    const prediction = await startRes.json();
    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: prediction.id, status: prediction.status })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
