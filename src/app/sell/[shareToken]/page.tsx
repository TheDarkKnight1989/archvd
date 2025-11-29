'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useCurrency } from '@/hooks/useCurrency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, DollarSign, MessageCircle, Tag } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface InventoryItem {
  id: string
  sku: string | null
  brand: string | null
  model: string | null
  colorway: string | null
  style_id: string | null
  size: string | null
  size_uk: number | null
  size_alt: string | null
  category: string
  condition: string | null
}

interface SellListItem {
  id: string
  asking_price: number | null
  position: number
  inventory_item: InventoryItem
  market_price?: number | null
}

interface SellListPublic {
  id: string
  name: string
  allow_comments: boolean
  show_market_prices: boolean
  allow_offers: boolean
  allow_asking_prices: boolean
  created_at: string
  items: SellListItem[]
}

interface Comment {
  id: string
  buyer_name: string | null
  message: string
  created_at: string
  sell_list_item_id: string | null
}

export default function PublicSellListPage() {
  const params = useParams()
  const { format } = useCurrency()
  const shareToken = params?.shareToken as string

  const [list, setList] = useState<SellListPublic | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Comment form state
  const [commentName, setCommentName] = useState('')
  const [commentEmail, setCommentEmail] = useState('')
  const [commentMessage, setCommentMessage] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  // Offer form state
  const [offerItemId, setOfferItemId] = useState<string | null>(null)
  const [offerName, setOfferName] = useState('')
  const [offerEmail, setOfferEmail] = useState('')
  const [offerAmount, setOfferAmount] = useState('')
  const [offerMessage, setOfferMessage] = useState('')
  const [submittingOffer, setSubmittingOffer] = useState(false)

  useEffect(() => {
    if (shareToken) {
      fetchList()
      fetchComments()
    }
  }, [shareToken])

  const fetchList = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/sell-lists/public/${shareToken}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError('Sell list not found')
          return
        }
        throw new Error('Failed to fetch sell list')
      }
      const data = await res.json()
      setList(data.sellList)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/sell-lists/public/${shareToken}/interactions`)
      if (res.ok) {
        const data = await res.json()
        setComments(data.interactions || [])
      }
    } catch (err) {
      // Silently fail - comments may not be enabled
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentMessage.trim()) return

    setSubmittingComment(true)
    try {
      const res = await fetch(`/api/sell-lists/public/${shareToken}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'comment',
          buyer_name: commentName.trim() || null,
          buyer_email: commentEmail.trim() || null,
          message: commentMessage.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit comment')
      }

      // Reset form
      setCommentName('')
      setCommentEmail('')
      setCommentMessage('')

      // Refresh comments
      await fetchComments()
      alert('Comment submitted successfully!')
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!offerAmount || parseFloat(offerAmount) <= 0) {
      alert('Please enter a valid offer amount')
      return
    }

    setSubmittingOffer(true)
    try {
      const res = await fetch(`/api/sell-lists/public/${shareToken}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'offer',
          buyer_name: offerName.trim() || null,
          buyer_email: offerEmail.trim() || null,
          message: offerMessage.trim() || null,
          offer_amount: parseFloat(offerAmount),
          sell_list_item_id: offerItemId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit offer')
      }

      // Reset form
      setOfferItemId(null)
      setOfferName('')
      setOfferEmail('')
      setOfferAmount('')
      setOfferMessage('')

      alert('Offer submitted successfully! The seller will be notified.')
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setSubmittingOffer(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !list) {
    return (
      <div className="min-h-screen bg-canvas p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-fg mb-4">
              {error || 'Sell list not found'}
            </h1>
            <p className="text-muted">
              This link may be invalid or the sell list may have been removed.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const getItemTitle = (item: InventoryItem) => {
    return [item.brand, item.model, item.colorway].filter(Boolean).join(' ') || item.sku || 'Untitled Item'
  }

  const getItemSize = (item: InventoryItem) => {
    if (item.size_uk) return `UK ${item.size_uk}`
    if (item.size) return item.size
    if (item.size_alt) return item.size_alt
    return null
  }

  return (
    <div className="min-h-screen bg-canvas p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-fg mb-2">{list.name}</h1>
          <p className="text-sm text-muted">
            {list.items.length} item{list.items.length !== 1 ? 's' : ''} for sale
          </p>
        </div>

        {/* Items Grid */}
        <div className="space-y-4 mb-8">
          {list.items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted">No items in this list</p>
            </div>
          ) : (
            list.items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-surface p-6 shadow-soft hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-fg mb-2">
                      {getItemTitle(item.inventory_item)}
                    </h3>

                    <div className="flex flex-wrap gap-3 text-sm text-muted mb-3">
                      {item.inventory_item.sku && (
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {item.inventory_item.sku}
                        </span>
                      )}
                      {getItemSize(item.inventory_item) && (
                        <span>Size: {getItemSize(item.inventory_item)}</span>
                      )}
                      {item.inventory_item.condition && (
                        <span className="capitalize">{item.inventory_item.condition}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4">
                      {list.allow_asking_prices && item.asking_price && (
                        <div className="flex items-center gap-2 text-accent font-semibold">
                          <DollarSign className="h-4 w-4" />
                          Asking: {format(item.asking_price)}
                        </div>
                      )}

                      {list.show_market_prices && item.market_price && (
                        <div className="flex items-center gap-2 text-muted text-sm">
                          Market: {format(item.market_price)}
                        </div>
                      )}
                    </div>
                  </div>

                  {list.allow_offers && (
                    <Button
                      onClick={() => setOfferItemId(item.id)}
                      variant="outline"
                      size="sm"
                      className="border-accent text-accent hover:bg-accent hover:text-fg"
                    >
                      Make Offer
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Offer Modal */}
        {offerItemId && list.allow_offers && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-elev-2 rounded-xl border border-border p-6 max-w-md w-full shadow-xl">
              <h2 className="text-xl font-bold text-fg mb-4">Make an Offer</h2>
              <form onSubmit={handleSubmitOffer} className="space-y-4">
                <div>
                  <Label htmlFor="offer-name" className="text-fg mb-2">
                    Your Name (optional)
                  </Label>
                  <Input
                    id="offer-name"
                    value={offerName}
                    onChange={(e) => setOfferName(e.target.value)}
                    placeholder="John Doe"
                    className="bg-elev-3 border-border text-fg"
                    disabled={submittingOffer}
                  />
                </div>

                <div>
                  <Label htmlFor="offer-email" className="text-fg mb-2">
                    Your Email (optional)
                  </Label>
                  <Input
                    id="offer-email"
                    type="email"
                    value={offerEmail}
                    onChange={(e) => setOfferEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="bg-elev-3 border-border text-fg"
                    disabled={submittingOffer}
                  />
                </div>

                <div>
                  <Label htmlFor="offer-amount" className="text-fg mb-2">
                    Offer Amount *
                  </Label>
                  <Input
                    id="offer-amount"
                    type="number"
                    step="0.01"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="bg-elev-3 border-border text-fg"
                    disabled={submittingOffer}
                  />
                </div>

                <div>
                  <Label htmlFor="offer-message" className="text-fg mb-2">
                    Message (optional)
                  </Label>
                  <Textarea
                    id="offer-message"
                    value={offerMessage}
                    onChange={(e) => setOfferMessage(e.target.value)}
                    placeholder="Any additional details..."
                    rows={3}
                    className="bg-elev-3 border-border text-fg resize-none"
                    disabled={submittingOffer}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={submittingOffer}
                    className="flex-1 bg-accent text-fg hover:bg-accent-600"
                  >
                    {submittingOffer ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit Offer
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setOfferItemId(null)}
                    disabled={submittingOffer}
                    variant="outline"
                    className="border-border text-fg hover:bg-elev-3"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Comments Section */}
        {list.allow_comments && (
          <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-xl font-bold text-fg mb-4 flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Comments
            </h2>

            {/* Comment Form */}
            <form onSubmit={handleSubmitComment} className="mb-6 pb-6 border-b border-border">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="comment-name" className="text-fg mb-2">
                      Name (optional)
                    </Label>
                    <Input
                      id="comment-name"
                      value={commentName}
                      onChange={(e) => setCommentName(e.target.value)}
                      placeholder="Your name"
                      className="bg-elev-3 border-border text-fg"
                      disabled={submittingComment}
                    />
                  </div>
                  <div>
                    <Label htmlFor="comment-email" className="text-fg mb-2">
                      Email (optional)
                    </Label>
                    <Input
                      id="comment-email"
                      type="email"
                      value={commentEmail}
                      onChange={(e) => setCommentEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="bg-elev-3 border-border text-fg"
                      disabled={submittingComment}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="comment-message" className="text-fg mb-2">
                    Comment *
                  </Label>
                  <Textarea
                    id="comment-message"
                    value={commentMessage}
                    onChange={(e) => setCommentMessage(e.target.value)}
                    placeholder="Write your comment here..."
                    rows={3}
                    required
                    maxLength={1000}
                    className="bg-elev-3 border-border text-fg resize-none"
                    disabled={submittingComment}
                  />
                  <p className="text-xs text-muted mt-1">
                    {commentMessage.length}/1000 characters
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={submittingComment || !commentMessage.trim()}
                  className="bg-accent text-fg hover:bg-accent-600"
                >
                  {submittingComment ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Post Comment
                    </>
                  )}
                </Button>
              </div>
            </form>

            {/* Comments List */}
            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-muted text-sm text-center py-4">
                  No comments yet. Be the first to comment!
                </p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="p-4 rounded-lg bg-elev-2">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-fg">
                        {comment.buyer_name || 'Anonymous'}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <p className="text-fg whitespace-pre-wrap">{comment.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
