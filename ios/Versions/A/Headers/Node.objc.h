// Objective-C API for talking to github.com/idena-network/idena-go/node Go package.
//   gobind -lang=objc github.com/idena-network/idena-go/node
//
// File is generated by gobind. Do not edit.

#ifndef __Node_H__
#define __Node_H__

@import Foundation;
#include "ref.h"
#include "Universe.objc.h"


@class NodeNode;
@class NodeNodeCtx;

@interface NodeNode : NSObject <goSeqRefInterface> {
}
@property(strong, readonly) _Nonnull id _ref;

- (nonnull instancetype)initWithRef:(_Nonnull id)ref;
// skipped constructor Node.NewNode with unsupported parameter or return types

- (void)start;
// skipped method Node.StartWithHeight with unsupported parameter or return types

- (void)waitForStop;
@end

@interface NodeNodeCtx : NSObject <goSeqRefInterface> {
}
@property(strong, readonly) _Nonnull id _ref;

- (nonnull instancetype)initWithRef:(_Nonnull id)ref;
- (nonnull instancetype)init;
@property (nonatomic) NodeNode* _Nullable node;
// skipped field NodeCtx.AppState with unsupported type: *github.com/idena-network/idena-go/core/appstate.AppState

// skipped field NodeCtx.Ceremony with unsupported type: *github.com/idena-network/idena-go/core/ceremony.ValidationCeremony

// skipped field NodeCtx.Blockchain with unsupported type: *github.com/idena-network/idena-go/blockchain.Blockchain

// skipped field NodeCtx.Flipper with unsupported type: *github.com/idena-network/idena-go/core/flip.Flipper

// skipped field NodeCtx.KeysPool with unsupported type: *github.com/idena-network/idena-go/core/mempool.KeysPool

// skipped field NodeCtx.OfflineDetector with unsupported type: *github.com/idena-network/idena-go/blockchain.OfflineDetector

@end

// skipped function NewNode with unsupported parameter or return types


// skipped function NewNodeWithInjections with unsupported parameter or return types


// skipped function OpenDatabase with unsupported parameter or return types


FOUNDATION_EXPORT NSString* _Nonnull NodeProvideMobileKey(NSString* _Nullable path, NSString* _Nullable cfg, NSString* _Nullable key, NSString* _Nullable password);

FOUNDATION_EXPORT NSString* _Nonnull NodeStartMobileNode(NSString* _Nullable path, NSString* _Nullable cfg);

#endif
