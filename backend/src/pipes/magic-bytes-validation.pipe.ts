import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';

@Injectable()
export class MagicBytesValidationPipe implements PipeTransform {
  async transform(file: Express.Multer.File, metadata: ArgumentMetadata) {
    if (!file) return file; 

    try {
      // Importation dynamique (contourne le conflit ESM/CommonJS de NestJS)
      const { fileTypeFromFile } = await (eval('import("file-type")') as Promise<any>);
      
      const fileType = await fileTypeFromFile(file.path);
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

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