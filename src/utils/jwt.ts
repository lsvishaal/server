import jwt from 'jsonwebtoken';
import { Response } from 'express';

export interface TokenPayload {
  id: string;
  email: string;
}

interface RefreshTokenPayload extends TokenPayload {
  type: 'refresh';
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_SECRET || 'your-default-secret-key';
  const expiresIn = process.env.JWT_EXPIRE || '7d';
  
  return jwt.sign(payload, secret, { expiresIn } as any);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'your-default-refresh-secret-key';
  const expiresIn = process.env.JWT_REFRESH_EXPIRE || '30d';
  
  return jwt.sign({ ...payload, type: 'refresh' }, secret, { expiresIn } as any);
};

export const generateToken = (payload: TokenPayload): string => {
  return generateAccessToken(payload);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  const secret = process.env.JWT_SECRET || 'your-default-secret-key';
  return jwt.verify(token, secret) as TokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'your-default-refresh-secret-key';
  const payload = jwt.verify(token, secret) as any;
  if (payload.type !== 'refresh') {
    throw new Error('Invalid refresh token');
  }
  return payload as RefreshTokenPayload;
};

export const verifyToken = (token: string): TokenPayload => {
  return verifyAccessToken(token);
};

export const sendTokenResponse = (
  user: { _id: any; email: string; name: string },
  statusCode: number,
  res: Response
): void => {
  const accessToken = generateAccessToken({ id: user._id.toString(), email: user.email });
  const refreshToken = generateRefreshToken({ id: user._id.toString(), email: user.email });
  
  const cookieExpire = parseInt(process.env.JWT_COOKIE_EXPIRE || '7', 10);
  
  const options = {
    expires: new Date(Date.now() + cookieExpire * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const
  };
  
  // Set access token cookie
  res.status(statusCode)
    .cookie('token', accessToken, options)
    .cookie('refreshToken', refreshToken, { ...options, expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })
    .json({
      success: true,
      token: accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name
      }
    });
};
