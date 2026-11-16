export class EntityNotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} "${id}" was not found`);
    this.name = 'EntityNotFoundError';
  }
}

export class DataConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataConflictError';
  }
}
