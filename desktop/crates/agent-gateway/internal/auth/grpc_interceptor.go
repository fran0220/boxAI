package auth

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const authenticateMethod = "/liveagent.gateway.v1.AgentGateway/Authenticate"

func GRPCUnaryInterceptor(expectedToken string) grpc.UnaryServerInterceptor {
	return GRPCUnaryInterceptorWithPolicy(expectedToken, true)
}

func GRPCUnaryInterceptorWithPolicy(expectedToken string, allowStatic bool) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req any,
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (any, error) {
		if info.FullMethod != authenticateMethod && !validateMetadataToken(ctx, expectedToken, allowStatic) {
			return nil, status.Error(codes.Unauthenticated, "invalid token")
		}
		return handler(ctx, req)
	}
}

func GRPCStreamInterceptor(expectedToken string) grpc.StreamServerInterceptor {
	return GRPCStreamInterceptorWithPolicy(expectedToken, true)
}

func GRPCStreamInterceptorWithPolicy(expectedToken string, allowStatic bool) grpc.StreamServerInterceptor {
	return func(
		srv any,
		stream grpc.ServerStream,
		info *grpc.StreamServerInfo,
		handler grpc.StreamHandler,
	) error {
		if !validateMetadataToken(stream.Context(), expectedToken, allowStatic) {
			return status.Error(codes.Unauthenticated, "invalid token")
		}
		return handler(srv, stream)
	}
}

func validateMetadataToken(ctx context.Context, expectedToken string, allowStatic bool) bool {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return false
	}
	if values := md.Get("authorization"); len(values) > 0 {
		for _, value := range values {
			if _, ok := ResolveBearerHeaderWithPolicy(value, expectedToken, allowStatic); ok {
				return true
			}
		}
	}
	if values := md.Get("token"); len(values) > 0 {
		for _, value := range values {
			if _, ok := ResolveTokenWithPolicy(value, expectedToken, allowStatic); ok {
				return true
			}
		}
	}
	return false
}
