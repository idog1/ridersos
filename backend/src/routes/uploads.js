import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export default async function uploadRoutes(fastify, options) {
  const uploadDir = process.env.UPLOAD_DIR || './uploads';

  // Upload file (replaces base44.integrations.Core.UploadFile)
  fastify.post('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = await request.file();
    
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    // Generate unique filename
    const ext = path.extname(data.filename);
    const filename = `${uuidv4()}${ext}`;
    const filepath = path.join(uploadDir, filename);

    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Save file
    const buffer = await data.toBuffer();
    fs.writeFileSync(filepath, buffer);

    // Return URL
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
    const fileUrl = `${baseUrl}/uploads/${filename}`;

    return { 
      file_url: fileUrl,
      filename: filename,
      original_name: data.filename,
      mimetype: data.mimetype,
      size: buffer.length
    };
  });

  // Upload multiple files
  fastify.post('/multiple', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const parts = request.files();
    const results = [];

    for await (const data of parts) {
      const ext = path.extname(data.filename);
      const filename = `${uuidv4()}${ext}`;
      const filepath = path.join(uploadDir, filename);

      const buffer = await data.toBuffer();
      fs.writeFileSync(filepath, buffer);

      const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
      const fileUrl = `${baseUrl}/uploads/${filename}`;

      results.push({
        file_url: fileUrl,
        filename: filename,
        original_name: data.filename,
        mimetype: data.mimetype,
        size: buffer.length
      });
    }

    return results;
  });

  // Delete file
  fastify.delete('/:filename', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const filepath = path.join(uploadDir, request.params.filename);

    if (!fs.existsSync(filepath)) {
      return reply.code(404).send({ error: 'File not found' });
    }

    fs.unlinkSync(filepath);

    return { success: true };
  });
}
