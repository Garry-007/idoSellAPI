import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../db';
import { AuthenticationError } from '../errors';

export const protectedRoute = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  // Retrieve the Authorization header from the request headers
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    throw new AuthenticationError('Invalid authentication credentials');
  }

  // Decode from Base64
  const base64Credentials = authHeader.split(' ')[1];
  const credentialsBuffer = Buffer.from(base64Credentials, 'base64');
  const credentials = credentialsBuffer.toString('ascii');

  // Expect credentials in the form "username:password"
  const [username, password] = credentials.split(':');
  if (!username || !password) {
    throw new AuthenticationError('Invalid authentication credentials');
  }

  // Retrieve the user record by username from the database.
  const userRecord = await prisma.user.findFirst({
    where: {
      revoked: false,
      username,
    },
  });

  if (!userRecord) {
    throw new AuthenticationError('Invalid credentials provided');
  }

  const isValid = await bcrypt.compare(password, userRecord.hashedPassword);
  if (!isValid) {
    throw new AuthenticationError('Invalid credentials provided');
  }

  // Credentials are valid. Continue to the next middleware or route handler.
  next();
};
