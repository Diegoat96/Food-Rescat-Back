export enum EstadoReserva {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  CANCELED = 'CANCELED',
}

export interface Reserva {
  id: string;
  status: string;
  createdAt?: string;
  completedAt?: string;
  packageName?: string;
  branchName?: string;
  branchCity?: string;
  package?: {
    id?: string;
    name?: string;
    imageUrl?: string;
    discountedPrice?: number;
    originalPrice?: number;
  };
  branch?: {
    id?: string;
    name?: string;
    city?: string;
    address?: string;
  };
  [key: string]: any; // Esto evita cualquier error de propiedades faltantes en TypeScript
}