import { ParserConfigApiResponseModel } from '@shared/models/api-model';

export type ParserConfigModel = ParserConfigApiResponseModel;

export type ParserConfigsModel = Record<string, ParserConfigModel>;
