import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Animated,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const RecommendationModal = ({
    visible,
    recommendations,
    scannedProductName,
    loading,
    onAddToCart,
    onDismiss,
}) => {
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 65,
                    friction: 11,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: SCREEN_HEIGHT,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    if (!visible) return null;

    const getReasonIcon = (reason) => {
        switch (reason) {
            case 'Same Category':
                return 'grid-outline';
            case 'Frequently Bought Together':
                return 'people-outline';
            case 'Popular in Store':
                return 'trending-up-outline';
            case 'Similar Price':
                return 'pricetag-outline';
            default:
                return 'storefront-outline';
        }
    };

    const getReasonColor = (reason) => {
        switch (reason) {
            case 'Same Category':
                return '#8B5CF6';
            case 'Frequently Bought Together':
                return '#F59E0B';
            case 'Popular in Store':
                return '#10B981';
            case 'Similar Price':
                return '#3B82F6';
            default:
                return '#6366F1';
        }
    };

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Backdrop */}
            <Animated.View
                style={[styles.backdrop, { opacity: backdropAnim }]}
            >
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={onDismiss}
                />
            </Animated.View>

            {/* Bottom Sheet */}
            <Animated.View
                style={[
                    styles.sheet,
                    { transform: [{ translateY: slideAnim }] },
                ]}
            >
                {/* Handle Bar */}
                <View style={styles.handleBar}>
                    <View style={styles.handle} />
                </View>

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={styles.aiIconBox}>
                            <Ionicons name="sparkles" size={18} color="#FFF" />
                        </View>
                        <View>
                            <Text style={styles.headerTitle}>Recommended For You</Text>
                            <Text style={styles.headerSubtitle}>
                                Based on {scannedProductName || 'your scan'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
                        <Ionicons name="close" size={20} color="#64748B" />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#6366F1" />
                        <Text style={styles.loadingText}>Finding best picks for you...</Text>
                    </View>
                ) : recommendations.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="bag-check-outline" size={48} color="#CBD5E1" />
                        <Text style={styles.emptyText}>You've got great taste!</Text>
                        <Text style={styles.emptySubtext}>No more recommendations right now</Text>
                    </View>
                ) : (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.carousel}
                        decelerationRate="fast"
                        snapToInterval={SCREEN_WIDTH * 0.62 + 12}
                    >
                        {recommendations.map((product, index) => (
                            <Animated.View
                                key={product._id}
                                style={[styles.card]}
                            >
                                {/* Score Badge */}
                                <View style={styles.scoreBadge}>
                                    <Ionicons name="diamond" size={10} color="#FFF" />
                                    <Text style={styles.scoreText}>
                                        {Math.round(product.score)}% match
                                    </Text>
                                </View>

                                {/* Product Icon */}
                                <View style={styles.productIconBox}>
                                    <Ionicons name="cube-outline" size={32} color="#6366F1" />
                                </View>

                                {/* Product Info */}
                                <Text style={styles.productName} numberOfLines={2}>
                                    {product.name}
                                </Text>

                                <Text style={styles.productPrice}>₹{product.price}</Text>

                                {/* Category */}
                                <View style={styles.categoryBadge}>
                                    <Text style={styles.categoryText}>{product.category}</Text>
                                </View>

                                {/* Reason Tags */}
                                <View style={styles.reasonsContainer}>
                                    {product.reasons.slice(0, 2).map((reason, i) => (
                                        <View
                                            key={i}
                                            style={[
                                                styles.reasonTag,
                                                { backgroundColor: getReasonColor(reason) + '18' },
                                            ]}
                                        >
                                            <Ionicons
                                                name={getReasonIcon(reason)}
                                                size={11}
                                                color={getReasonColor(reason)}
                                            />
                                            <Text
                                                style={[styles.reasonText, { color: getReasonColor(reason) }]}
                                                numberOfLines={1}
                                            >
                                                {reason}
                                            </Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Add to Cart Button - Commented out as requested */}
                                {/* <TouchableOpacity
                                    style={styles.addBtn}
                                    onPress={() => onAddToCart(product)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="cart-outline" size={16} color="#FFF" />
                                    <Text style={styles.addBtnText}>Add to Cart</Text>
                                </TouchableOpacity> */}
                            </Animated.View>
                        ))}
                    </ScrollView>
                )}
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 30,
        maxHeight: SCREEN_HEIGHT * 0.55,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 20,
    },
    handleBar: {
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 4,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E2E8F0',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    aiIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#6366F1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 1,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#334155',
        marginTop: 12,
    },
    emptySubtext: {
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 4,
    },
    carousel: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    card: {
        width: SCREEN_WIDTH * 0.62,
        backgroundColor: '#FAFBFF',
        borderRadius: 18,
        padding: 16,
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#EEF2FF',
        position: 'relative',
    },
    scoreBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#6366F1',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    scoreText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFF',
    },
    productIconBox: {
        width: 52,
        height: 52,
        borderRadius: 14,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    productName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 4,
        lineHeight: 20,
    },
    productPrice: {
        fontSize: 18,
        fontWeight: '800',
        color: '#10B981',
        marginBottom: 8,
    },
    categoryBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginBottom: 8,
    },
    categoryText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
    },
    reasonsContainer: {
        flexDirection: 'column',
        gap: 4,
        marginBottom: 12,
    },
    reasonTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    reasonText: {
        fontSize: 10,
        fontWeight: '600',
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#6366F1',
        paddingVertical: 10,
        borderRadius: 12,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
    },
    addBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFF',
    },
});

export default RecommendationModal;
