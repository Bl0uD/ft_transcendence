import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';

@Injectable()
export class MagicBytesValidationPipe implements PipeTransform {
  async transform(file: Express.Multer.File, metadata: ArgumentMetadata) {
    if (!file) return file; 

    try {
      // Compatibilité avec file-type v16 (CommonJS, fromFile) et v17+ (ESM, fileTypeFromFile)
      const ft = require('file-type');
      const getFileType = ft.fromFile || ft.fileTypeFromFile;
      
      const fileType = await getFileType(file.path);
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

      if (!fileType || !allowedMimeTypes.includes(fileType.mime)) {
        fs.unlinkSync(file.path);
        throw new BadRequestException("Le fichier envoyé n'est pas une image valide ou est corrompu.");
      }
    } catch (error) {
      // En cas d'erreur inattendue, on nettoie le fichier pour ne pas polluer le NAS
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new BadRequestException("Erreur lors de la vérification du fichier.");
    }

    return file;
  }
}
