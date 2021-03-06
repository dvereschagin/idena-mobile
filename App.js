import React from 'react'
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  Image,
  // NativeModules,
} from 'react-native'
import {
  Provider as PaperProvider,
  ActivityIndicator,
  Card,
} from 'react-native-paper'
import Icon from 'react-native-vector-icons/MaterialIcons'

import { Colors } from 'react-native/Libraries/NewAppScreen'
import { createAppContainer, createBottomTabNavigator } from 'react-navigation'
import { useRpc, useInterval, useTimeout, usePoll } from './lib'
import {
  useValidationState,
  ValidationProvider,
  useValidationDispatch,
  SessionType,
  fetchFlips,
  PICK,
  ANSWER,
  AnswerType,
  hasAnswer,
  submitShortAnswers,
  NEXT,
  REPORT_ABUSE,
  submitLongAnswers,
  START_FETCH_FLIPS,
  SHOW_EXTRA_FLIPS,
  EpochPeriod,
  useValidationTimer,
} from './validation'
import { arrayBufferToBase64, reorderList } from './utils'
import {
  EpochProvider,
  useEpochState,
  useTimingState,
  TimingProvider,
} from './epoch'
import { EXTRA_FLIPS_DELAY } from './config'

// const { IdenaNode } = NativeModules
// IdenaNode.start()

function Screen({ children }) {
  return (
    <PaperProvider>
      <AppProviders>
        <View style={styles.full}>
          <StatusBar barStyle="dark-content" />
          <SafeAreaView style={styles.full}>
            <View
              // contentInsetAdjustmentBehavior="automatic"
              style={styles.scrollView}
            >
              <WithValidation>{children}</WithValidation>
            </View>
          </SafeAreaView>
        </View>
      </AppProviders>
    </PaperProvider>
  )
}

function AppProviders({ children }) {
  return (
    <TimingProvider>
      <EpochProvider>{children}</EpochProvider>
    </TimingProvider>
  )
}

function WithValidation({ children }) {
  const epoch = useEpochState()

  const isValidationRunning =
    epoch &&
    [EpochPeriod.ShortSession, EpochPeriod.LongSession].includes(
      epoch.currentPeriod
    )

  return (
    <View style={styles.body}>
      {!isValidationRunning && children}
      {isValidationRunning && (
        <ValidationProvider>
          <ValidationScreen />
        </ValidationProvider>
      )}
    </View>
  )
}

function Profile() {
  const [{ result: identity }] = usePoll(useRpc('dna_identity'), 1000 * 1)

  if (!identity) {
    return (
      <Card style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Loading...</Text>
      </Card>
    )
  }

  const { address, state, totalShortFlipPoints, totalQualifiedFlips } = identity

  return (
    <Card style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>My Idena</Text>
      <Text style={styles.sectionDescription}>{address}</Text>
      <Text style={styles.sectionDescription}>{state}</Text>
      {totalQualifiedFlips > 0 && (
        <Text style={styles.sectionDescription}>
          {`${totalShortFlipPoints} out of ${totalQualifiedFlips} (${Number(
            totalShortFlipPoints / totalQualifiedFlips
          ).toLocaleString(undefined, { style: 'percent' })}) `}
        </Text>
      )}
    </Card>
  )
}

function BeforeValidation() {
  const epoch = useEpochState()

  const [text, setText] = React.useState()

  React.useEffect(() => {
    if (epoch) {
      switch (epoch.currentPeriod) {
        case EpochPeriod.None: {
          setText('Waiting for validation')
          break
        }
        case EpochPeriod.FlipLottery: {
          setText('Shuflling flips')
          break
        }
        case EpochPeriod.AfterLongSession: {
          setText('Waiting for validation results')
          break
        }
        default: {
          setText('Mmm...')
        }
      }
    }
  }, [epoch])

  return (
    <Card style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>{text}</Text>
      {epoch && epoch.currentPeriod === EpochPeriod.None && (
        <Text style={styles.sectionDescription}>
          {new Date(epoch.nextValidation).toLocaleString()}
        </Text>
      )}
    </Card>
  )
}

function ValidationScreen() {
  const {
    flips,
    currentIndex,
    shortAnswersSubmitted,
    longAnswersSubmitted,
    ready,
  } = useValidationState()
  const dispatch = useValidationDispatch()

  const [{ result: epoch }] = useRpc('dna_epoch')

  const isShortSession =
    epoch && epoch.currentPeriod === EpochPeriod.ShortSession

  React.useEffect(() => {
    if (!ready && !shortAnswersSubmitted) {
      dispatch({ type: START_FETCH_FLIPS })
    }
    if (!ready && !longAnswersSubmitted) {
      dispatch({ type: START_FETCH_FLIPS })
    }
  }, [dispatch, longAnswersSubmitted, ready, shortAnswersSubmitted])

  useInterval(
    async () =>
      dispatch(
        fetchFlips(
          isShortSession && !shortAnswersSubmitted
            ? SessionType.Short
            : SessionType.Long,
          flips
        )
      ),
    ready ? null : 1000 * 1,
    true
  )

  useTimeout(() => {
    if (!ready && !shortAnswersSubmitted) {
      dispatch({ type: SHOW_EXTRA_FLIPS })
    }
  }, EXTRA_FLIPS_DELAY)

  const isLast = currentIndex >= flips.length - 1

  if (shortAnswersSubmitted && longAnswersSubmitted) {
    return (
      <Card style={styles.sectionContainer}>
        <Text style={styles.sectionDescription}>
          Waiting for the end of validation
        </Text>
      </Card>
    )
  }

  return (
    <View style={styles.validationContainer}>
      <View style={styles.validationHeading}>
        <Text style={styles.validationTitle}>Validation session</Text>
        <Text style={styles.validationParagraph}>
          Select a meaningful story: left or right ({currentIndex + 1} of{' '}
          {flips.length})
        </Text>
      </View>
      <View style={styles.validationScene}>
        <ThumbList>
          {flips.map((flip, index) => (
            <Thumb
              key={flip.hash}
              index={index}
              isCurrent={index === currentIndex}
              {...flip}
            ></Thumb>
          ))}
        </ThumbList>
        <View style={styles.flipsContainer}>
          <View style={styles.flipsCol}>
            <Flip {...flips[currentIndex]} option={AnswerType.Left} />
          </View>
          <View style={styles.flipsCol}>
            <Flip {...flips[currentIndex]} option={AnswerType.Right} />
          </View>
        </View>

        <Timer
          type={shortAnswersSubmitted ? SessionType.Long : SessionType.Short}
        />

        <TouchableOpacity
          style={styles.buttonReject}
          onPress={() => dispatch({ type: REPORT_ABUSE })}
        >
          <View style={styles.buttonRejectInner}>
            <Icon name="flash-on" size={20} color="rgb(255,102,102)" />
            <Text style={styles.buttonText}>Reject</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.buttonNext}
          onPress={async () => {
            if (isLast) {
              if (!shortAnswersSubmitted) {
                dispatch(submitShortAnswers(flips, epoch.epoch))
              } else {
                dispatch(submitLongAnswers(flips, epoch.epoch))
              }
            } else {
              dispatch({ type: NEXT })
            }
          }}
        >
          <View style={styles.buttonNextInner}>
            <Icon name="arrow-forward" size={20} color="rgb(87,143,255)" />
            <Text style={styles.buttonText}>{isLast ? 'Confirm' : 'Next'}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function ThumbList({ children }) {
  return (
    <View style={styles.thumbs}>
      <ScrollView
        horizontal
        style={styles.thumbsScrollContainer}
        contentContainerStyle={{ marginLeft: 'auto', marginRight: 'auto' }}
      >
        {children}
      </ScrollView>
    </View>
  )
}

function Thumb({ pics, orders, index, ready, failed, answer, isCurrent }) {
  const dispatch = useValidationDispatch()
  return (
    <TouchableOpacity onPress={() => dispatch({ type: PICK, index })}>
      <View style={styles.thumbCol}>
        {failed ? (
          <View style={styles.thumb}>
            <View style={styles.thumbOverlay}>
              <Icon name="close" size={20} color="#fff" />
            </View>
          </View>
        ) : (
          <View style={isCurrent ? styles.thumbCurrent : styles.thumb}>
            {ready ? (
              <FlipImage
                source={{
                  uri: `data:image/png;base64,${arrayBufferToBase64(
                    reorderList(pics, orders[0])[0]
                  )}`,
                }}
                width={44}
                height={44}
                style={styles.thumbImage}
              />
            ) : (
              <ActivityIndicator />
            )}
            {hasAnswer(answer) && (
              <View style={styles.thumbOverlay}>
                <Icon
                  name={
                    answer === AnswerType.Inappropriate ? 'flash-on' : 'check'
                  }
                  size={20}
                  color="#fff"
                />
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

function Flip({ pics = [], answer, ready, orders, failed, option }) {
  const dispatch = useValidationDispatch()

  if (!ready && !failed) {
    return <ActivityIndicator />
  }

  if (failed) return <EmptyFlip />

  const isSelected = hasAnswer(answer) && answer === option
  if (ready && !failed) {
    return (
      <TouchableOpacity onPress={() => dispatch({ type: ANSWER, option })}>
        <View style={isSelected ? styles.flipActive : styles.flip}>
          <FlipImageList>
            {reorderList(pics, orders[option - 1]).map((src, idx) => (
              <FlipImage
                key={idx}
                source={{
                  uri: `data:image/png;base64,${arrayBufferToBase64(src)}`,
                }}
                width={144}
                height={120}
                style={styles.flipImage}
              />
            ))}
          </FlipImageList>
        </View>
      </TouchableOpacity>
    )
  }

  return null
}

function EmptyFlip() {
  return [1, 2, 3, 4].map((_, idx) => (
    <View key={`empty-${idx}`} style={styles.flip}>
      <FlipImage
        source={{ uri: 'https://placehold.it/144x120?text=No+data' }}
        width={144}
        height={120}
        style={styles.flipImage}
      />
    </View>
  ))
}

function FlipImageList({ children }) {
  return <View>{children}</View>
}

function FlipImage({ source, width, height, style }) {
  return (
    <Image
      source={source}
      style={{ ...style, width, height }}
      PlaceholderContent={<ActivityIndicator />}
    />
  )
}

function Timer({ type }) {
  let seconds = useValidationTimer()
  const epoch = useEpochState()
  const timing = useTimingState()

  if (!epoch || !timing) {
    return null
  }

  if (
    type === SessionType.Long &&
    epoch.currentPeriod === EpochPeriod.ShortSession
  ) {
    seconds += timing.LongSessionDuration
  }

  return (
    <View style={styles.timer}>
      <Icon
        name="timer"
        size={20}
        color="rgb(255,102,102)"
        style={{ marginRight: 5 }}
      />
      <Text style={{ color: 'rgb(255,102,102)' }}>
        {[Math.floor(seconds / 60), seconds % 60]
          .map(t => t.toString().padStart(2, 0))
          .join(':')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
  },
  scrollView: {
    backgroundColor: Colors.lighter,
    flex: 1,
  },
  body: {
    backgroundColor: Colors.black,
    flex: 1,
  },
  sectionContainer: {
    flex: 1,
    marginTop: 32,
    marginHorizontal: 24,
    padding: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.black,
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
    color: Colors.black,
  },
  validationContainer: {
    flex: 1,
    // paddingTop: Constants.statusBarHeight,
    backgroundColor: '#000',
    color: '#fff',
    fontSize: 14,
  },
  validationHeading: {
    width: 190,
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingTop: 13,
  },
  validationParagraph: {
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: 'rgb(150, 153, 158)',
  },
  validationTitle: {
    marginBottom: 10,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#fff',
  },
  validationScene: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
    position: 'relative',
    overflow: 'hidden',
  },
  thumbs: {
    width: '100%',
    marginBottom: 30,
  },
  thumbsScrollContainer: {
    width: '100%',
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 4,
    paddingBottom: 4,
  },
  thumbCol: {
    marginLeft: 4,
    marginRight: 4,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
  },
  thumbCurrent: {
    width: 44,
    height: 44,
    borderRadius: 16,
    marginLeft: 4,
    marginRight: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'white',
    // boxShadow: '0 0 0 1px #fff',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(89,89,89,0.8)',
    color: '#fff',
  },
  flipsContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  flipsCol: {
    paddingLeft: 12,
    paddingRight: 12,
  },
  flip: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 4,
    borderStyle: 'solid',
    borderColor: 'transparent',
  },
  flipActive: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 4,
    borderStyle: 'solid',
    borderColor: 'rgb(87,143,255)',
    // boxShadow: '0 0 0 2px rgb(87,143,255), 0 0 0 5px rgba(87,143,255, .25)',
  },
  flipImage: {
    width: 140,
    height: 120,
    resizeMode: 'cover',
  },
  timer: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    color: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    width: 70,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'center',
    transform: [{ translateX: -35 }],
  },
  buttonReject: {
    position: 'absolute',
    bottom: -96,
    left: -96,
    backgroundColor: 'rgba(255,102,102,.3)',
    borderRadius: 200,
    width: 192,
    height: 192,
  },
  buttonRejectInner: {
    textAlign: 'center',
    display: 'flex',
    position: 'absolute',
    top: 8,
    right: 10,
    width: 96,
    height: 96,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
  },
  buttonNext: {
    position: 'absolute',
    bottom: -96,
    right: -96,
    backgroundColor: 'rgba(87,143,255,.3)',
    borderRadius: 200,
    width: 192,
    height: 192,
  },
  buttonNextInner: {
    textAlign: 'center',
    display: 'flex',
    position: 'absolute',
    top: 8,
    left: 10,
    width: 96,
    height: 96,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
  },
  buttonText: {
    color: '#fff',
  },
})

const MainNavigator = createBottomTabNavigator(
  {
    Home: {
      screen: () => (
        <Screen>
          <Profile />
          <BeforeValidation />
        </Screen>
      ),
    },
    Contacts: () => (
      <Screen>
        <Text style={{ color: 'white' }}>Contacts</Text>
      </Screen>
    ),
    Chats: () => (
      <Screen>
        <Text style={{ color: 'white' }}>Chats</Text>
      </Screen>
    ),
    Validation: {
      screen: () => (
        <Screen>
          <ValidationProvider>
            <ValidationScreen />
          </ValidationProvider>
        </Screen>
      ),
    },
  },
  {
    defaultNavigationOptions: ({ navigation }) => ({
      tabBarIcon: ({ tintColor }) => {
        const { routeName } = navigation.state
        const IconComponent = Icon
        let iconName

        switch (routeName) {
          case 'Home':
            iconName = 'home'
            break
          case 'Contacts':
            iconName = 'contacts'
            break
          case 'Wallets':
            iconName = 'account-balance-wallet'
            break
          case 'Chats':
            iconName = 'chat'
            break
          case 'Validation':
            iconName = 'check'
            break
          default:
            break
        }

        return <IconComponent name={iconName} size={25} color={tintColor} />
      },
    }),
    tabBarOptions: {
      activeTintColor: 'rgb(87,143,255)',
      inactiveTintColor: 'rgb(210,212,217)',
    },
  }
)

export default createAppContainer(MainNavigator)
