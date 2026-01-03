export interface VisaData {
  fullName: string;
  email?: string;
  passportNumber: string;
  visaNumber: string;
  birthDate: string;
  clientPhoto?: string;
  medinaHotel?: string;
  meccaHotel?: string;
  roomType?: string;
}

export interface BadgeData extends VisaData {
  medinaHotel: string;
  meccaHotel: string;
  roomType: string;
  email?: string;
  moroccoPhone?: string;
  saudiPhone?: string;
}

export type RoomType = 'فردي' | 'ثنائي' | 'ثلاثي' | 'رباعي' | 'خماسي';

export interface Client {
  id: string;
  fullname: string;
  email: string;
  passportnumber?: string;
  visanumber?: string;
  birthdate?: string;
  medinahotel?: string;
  meccahotel?: string;
  roomtype?: string;
  clientphoto?: string;
  createdat: string;
}
