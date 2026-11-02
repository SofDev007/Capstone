const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');

// Create assets directory if it doesn't exist
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Create a simple colored image
async function createPlaceholderImage(outputPath, width, height, color = '#4A90E2') {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${color}"/>
      <text x="50%" y="50%" font-family="Arial" font-size="${Math.min(width, height) / 4}" fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">TD</text>
    </svg>
  `;
  
  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);
  
  console.log(`Created: ${outputPath}`);
}

async function generateAssets() {
  try {
    console.log('Generating placeholder assets...');
    
    // Generate icon.png (1024x1024)
    await createPlaceholderImage(
      path.join(assetsDir, 'icon.png'),
      1024,
      1024,
      '#4A90E2'
    );
    
    // Generate splash.png (1242x2436)
    await createPlaceholderImage(
      path.join(assetsDir, 'splash.png'),
      1242,
      2436,
      '#4A90E2'
    );
    
    // Generate adaptive-icon.png (1024x1024)
    await createPlaceholderImage(
      path.join(assetsDir, 'adaptive-icon.png'),
      1024,
      1024,
      '#4A90E2'
    );
    
    // Generate favicon.png (48x48)
    await createPlaceholderImage(
      path.join(assetsDir, 'favicon.png'),
      48,
      48,
      '#4A90E2'
    );
    
    console.log('✅ All assets generated successfully!');
  } catch (error) {
    console.error('Error generating assets:', error);
    process.exit(1);
  }
}

generateAssets();

