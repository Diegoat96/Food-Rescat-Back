import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type NotificationType =
  | 'RESERVATION_CONFIRMED'
  | 'RESERVATION_COMPLETED'
  | 'PACKAGE_EXPIRING'
  | 'BUSINESS_REQUEST_APPROVED'
  | 'BUSINESS_REQUEST_REJECTED';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForUser(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
      },
    });
  }

  async findAllByUser(userId: string) {
    const notificaciones = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return notificaciones.map((notificacion) => ({
      ...notificacion,
      title: this.traducirTitulo(notificacion.title),
      message: this.traducirMensaje(notificacion.message),
    }));
  }

  private traducirTitulo(title: string): string {
    const titulos: Record<string, string> = {
      'Reservation confirmed': 'Reserva confirmada',
      'Reservation completed': 'Reserva completada',
      'Package expiring soon': 'Tu paquete está por vencer',
    };
    return titulos[title] ?? title;
  }

  private traducirMensaje(message: string): string {
    const patrones: { patron: RegExp; reemplazo: (args: RegExpMatchArray) => string }[] = [
      {
        patron: /^Your reservation for (.+) at (.+) has been confirmed\.$/,
        reemplazo: (args) => `Tu reserva de ${args[1]} en ${args[2]} ha sido confirmada.`,
      },
      {
        patron: /^Your reservation for (.+) has been marked as completed\.$/,
        reemplazo: (args) => `Tu reserva de ${args[1]} ha sido marcada como completada.`,
      },
      {
        patron: /^Your reserved package "(.+)" at (.+) expires in less than 30 minutes\.$/,
        reemplazo: (args) => `Tu paquete reservado "${args[1]}" en ${args[2]} vence en menos de 30 minutos.`,
      },
    ];
    for (const { patron, reemplazo } of patrones) {
      const coincidencia = message.match(patron);
      if (coincidencia) {
        return reemplazo(coincidencia);
      }
    }
    return message;
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('You can only mark your own notifications as read');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }
}
