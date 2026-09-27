export abstract class HealthRepository {abstract ready(collectionEnabled:boolean,batchEnabled?:boolean,directEnabled?:boolean):Promise<boolean>}
