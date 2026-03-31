exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { imageBase64, mediaType } = JSON.parse(event.body);

    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: "15a3689ee13b0d2616e98820eca31d4c3abcd36672df6afce5cb6feb1d66087d",
        input: {
          image: `data:${mediaType};base64,${imageBase64}`,
          prompt: "beautiful watercolor painting, soft watercolor style, white background, artistic brushstrokes, pastel colors, painted portrait",
          negative_prompt: "photo, realistic, photography, sharp, detailed",
          prompt_strength: 0.7,
          num_inference_steps: 30,
          guidance_scale: 7.5
        }
      })
    });

    const prediction = await startRes.json();

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

    if (result.status === 'failed' || !result.output) {
      throw new Error('Transformation échouée : ' + JSON.stringify(result.error));
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
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
