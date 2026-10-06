export abstract class HealthRepository {abstract commonCodesReady():Promise<boolean>; abstract ready(collectionEnabled:boolean,batchEnabled?:boolean,directEnabled?:boolean):Promise<boolean>}
