import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as FileType from 'file-type';

@Injectable()
export class MagicBytesValidationPipe implements PipeTransform {
  async transform(file: Express.Multer.File, metadata: ArgumentMetadata) {
    if (!file) return file; // Si aucun fichier n'est envoyé, on passe au validateur suivant

    // Lecture des Magic Bytes du fichier stocké sur le disque
    const fileType = await FileType.fromFile(file.path);
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!fileType || !allowedMimeTypes.includes(fileType.mime)) {
      // Si le fichier est invalide, on le supprime immédiatement
      fs.unlinkSync(file.path);
      throw new BadRequestException("Le fichier envoyé n'est pas une image valide ou est corrompu.");
    }

    return file;
  }
}