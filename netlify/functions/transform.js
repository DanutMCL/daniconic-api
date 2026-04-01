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
    const body = JSON.parse(event.body);

    // Mode poll
    if (body.predictionId) {
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${body.predictionId}`, {
        headers: { 'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}` }
      });
      const result = await pollRes.json();
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      };
    }

    // Mode proxy image : récupère l'image depuis Replicate et la renvoie en base64
    if (body.imageUrl) {
      const imgRes = await fetch(body.imageUrl);
      const arrayBuffer = await imgRes.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: `data:${contentType};base64,${base64}` })
      };
    }

    // Mode création
    const { imageBase64, mediaType } = body;

    // Upload sur Cloudinary d'abord pour avoir une URL publique
    const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/dmdcnaoy1/image/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: `data:${mediaType};base64,${imageBase64}`,
        upload_preset: 'daniconic_watercolor'
      })
    });
    const cloudData = await cloudRes.json();
    const imageUrl = cloudData.secure_url;

    if (!imageUrl) throw new Error('Upload Cloudinary échoué: ' + JSON.stringify(cloudData));

    // Lancer Replicate avec l'URL publique
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
